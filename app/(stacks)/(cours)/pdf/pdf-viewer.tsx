import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState, useCallback, useEffect } from "react";
import { Pressable, Text, View, ActivityIndicator, Linking, ScrollView, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "@/services/redux/store";
import { documentDirectory, downloadAsync, deleteAsync } from "expo-file-system/legacy";
import { cleanAndAuthUrl, getUserToken } from "@/services/urlAuth";

const IS_DEV = process.env.NODE_ENV === "development";

interface PdfPage {
  pageNum: number;
  textContent: string;
  images: string[];
}

interface PdfOutlineItem {
  title: string;
  page: number;
  children?: PdfOutlineItem[];
}

export default function PdfViewerScreen() {
  const router = useRouter();
  const { pdfUrl, title } = useLocalSearchParams<{ pdfUrl?: string; title?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [showOutline, setShowOutline] = useState(false);
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [outline, setOutline] = useState<PdfOutlineItem[]>([]);
  const [showExtract, setShowExtract] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');

  const extractPdfContent = async (localUri: string): Promise<{ text: string; pages: PdfPage[]; outline: PdfOutlineItem[] }> => {
    if (IS_DEV) console.log('[PdfViewer] Extracting PDF content...');
    
    const pages: PdfPage[] = [];
    let fullText = '';
    const outline: PdfOutlineItem[] = [];
    
    const pdfJsHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: sans-serif; padding: 20px; background: #FAF9F6; }
          canvas { border: 1px solid #ddd; margin-bottom: 10px; display: block; }
          #text-output { white-space: pre-wrap; line-height: 1.6; }
          .page-num { color: #666; font-size: 12px; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div id="text-output"></div>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          let pageInfo = [];
          
          async function extractContent() {
            try {
              const loadingTask = pdfjsLib.getDocument('file://${localUri}');
              const pdf = await loadingTask.promise;
              
              let fullText = '';
              const numPages = pdf.numPages;
              
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pageCount',
                count: numPages
              }));
              
              for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                
                fullText += '\\n--- Page ' + i + ' ---\\n' + pageText;
                
                const canvas = document.createElement('canvas');
                const scale = 1.5;
                const viewport = page.getViewport({ scale });
                
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                const context = canvas.getContext('2d');
                await page.render({
                  canvasContext: context,
                  viewport: viewport
                }).promise;
                
                const imageData = canvas.toDataURL('image/jpeg', 0.7);
                
                pageInfo.push({
                  pageNum: i,
                  textContent: pageText,
                  imageData: imageData
                });
                
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'pageProgress',
                  page: i,
                  total: numPages,
                  text: pageText.substring(0, 200)
                }));
              }
              
              document.getElementById('text-output').textContent = fullText;
              
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'extractionComplete',
                fullText: fullText,
                pages: pageInfo
              }));
              
            } catch (err) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'extractionError',
                error: err.message
              }));
            }
          }
          
          extractContent();
        </script>
      </body>
      </html>
    `;
    
    return new Promise((resolve) => {
      const webviewRef: any = { current: null };
      
      setTimeout(() => {
        resolve({ text: fullText, pages, outline });
      }, 30000);
    });
  };

  const downloadPdf = useCallback(async () => {
    if (!pdfUrl) {
      setError("URL PDF manquante");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (IS_DEV) console.log('[PdfViewer] Downloading PDF...');

      const authToken = getUserToken(token);
      const authUrl = cleanAndAuthUrl(pdfUrl, token);
      const filename = `temp_${Date.now()}.pdf`;
      const localUri = `${documentDirectory}${filename}`;

      const downloadResult = await downloadAsync(authUrl, localUri);
      
      if (downloadResult.status === 200) {
        if (IS_DEV) console.log('[PdfViewer] PDF downloaded to:', localUri);
        setLocalPath(localUri);
        setTotalPages(1);
      } else {
        if (IS_DEV) console.warn('[PdfViewer] Download failed:', downloadResult.status);
        setError("Impossible de télécharger le PDF");
      }
    } catch (err: any) {
      if (IS_DEV) console.error('[PdfViewer] Error:', err);
      setError(err.message || "Erreur lors du chargement du PDF");
    } finally {
      setIsLoading(false);
    }
  }, [pdfUrl, token]);

  const handleExtractText = async () => {
    if (!localPath) return;
    
    setShowExtract(true);
    setExtractedText("Extraction en cours...");
    
    const authUrl = `file://${localPath}`;
    if (IS_DEV) console.log('[PdfViewer] Extracting text from:', authUrl);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'pageCount') {
        setTotalPages(data.count);
        if (IS_DEV) console.log('[PdfViewer] Total pages:', data.count);
      } else if (data.type === 'pageProgress') {
        if (IS_DEV) console.log(`[PdfViewer] Page ${data.page}/${data.total}`);
      } else if (data.type === 'extractionComplete') {
        setExtractedText(data.fullText || "Aucun texte extrait");
        if (IS_DEV) console.log('[PdfViewer] Extraction complete, text length:', data.fullText?.length);
      } else if (data.type === 'extractionError') {
        setExtractedText("Erreur d'extraction: " + data.error);
      }
    } catch {}
  };

  React.useEffect(() => {
    downloadPdf();
    
    return () => {
      if (localPath) {
        deleteAsync(localPath, { idempotent: true }).catch(() => {});
      }
    };
  }, []);

  const handleOpenExternal = () => {
    if (pdfUrl) {
      const authUrl = cleanAndAuthUrl(pdfUrl);
      Linking.openURL(authUrl);
    }
  };

  const googleDocsViewerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #FAF9F6; }
        iframe { width: 100%; height: 100vh; border: none; }
      </style>
    </head>
    <body>
      ${localPath ? `
        <iframe src="file://${localPath}" type="application/pdf"></iframe>
      ` : `
        <div style="padding: 40px; text-align: center; font-family: sans-serif;">
          <p>Chargement du PDF...</p>
        </div>
      `}
    </body>
    </html>
  `;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6] items-center justify-center">
        <ActivityIndicator size="large" color="#002366" />
        <Text className="mt-4 text-gray-600">Chargement du PDF...</Text>
        <Text className="mt-2 text-gray-400 text-xs">Téléchargement en cours</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={["top"]}>
        <View className="px-5 py-4 flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-4 p-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold flex-1" numberOfLines={1}>{title || 'PDF'}</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Feather name="file-text" size={64} color="#D1D5DB" />
          <Text className="text-gray-500 mt-4 text-center">{error}</Text>
          <Text className="text-gray-400 text-sm mt-2 text-center mb-6">
            Le PDF ne peut pas être affiché dans l&apos;application
          </Text>
          <Pressable
            onPress={handleOpenExternal}
            className="bg-[#002366] px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Ouvrir dans le navigateur</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={["top"]}>
      <View className="px-4 py-3 flex-row items-center bg-white border-b border-gray-200">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
            {title || 'Document PDF'}
          </Text>
          {totalPages > 0 && (
            <Text className="text-xs text-gray-500">{totalPages} pages</Text>
          )}
        </View>
        <Pressable onPress={() => setShowOutline(true)} className="p-2">
          <Feather name="list" size={24} color="#002366" />
        </Pressable>
        <Pressable onPress={handleExtractText} className="p-2">
          <Ionicons name="document-text" size={24} color="#002366" />
        </Pressable>
        <Pressable onPress={handleOpenExternal} className="p-2">
          <Feather name="external-link" size={24} color="#002366" />
        </Pressable>
      </View>

      {localPath ? (
        <View className="flex-1 bg-gray-100">
          <WebView
            source={{ uri: `file://${localPath}` }}
            style={{ flex: 1 }}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center bg-gray-100">
                <ActivityIndicator size="large" color="#002366" />
              </View>
            )}
            onError={() => {
              if (IS_DEV) console.warn('[PdfViewer] WebView error, trying external');
              handleOpenExternal();
            }}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
          />
        </View>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">PDF non disponible</Text>
        </View>
      )}

      <Modal visible={showExtract} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[85%]">
            <View className="px-5 py-4 border-b border-gray-200 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="document-text" size={24} color="#002366" className="mr-2" />
                <Text className="text-lg font-bold">Contenu du PDF</Text>
              </View>
              <Pressable onPress={() => setShowExtract(false)} className="p-2">
                <Feather name="x" size={24} color="#6B7280" />
              </Pressable>
            </View>
            <ScrollView className="px-5 py-4">
              {extractedText ? (
                <Text className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {extractedText}
                </Text>
              ) : (
                <View className="items-center py-8">
                  <Ionicons name="hourglass-outline" size={48} color="#D1D5DB" />
                  <Text className="text-gray-500 mt-4 text-center">
                    Extraction en cours...
                  </Text>
                  <Text className="text-gray-400 text-xs mt-2 text-center">
                    Patientez pendant le traitement du PDF
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showOutline} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="px-5 py-4 border-b border-gray-200 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Feather name="list" size={24} color="#002366" className="mr-2" />
                <Text className="text-lg font-bold">Table des matières</Text>
              </View>
              <Pressable onPress={() => setShowOutline(false)} className="p-2">
                <Feather name="x" size={24} color="#6B7280" />
              </Pressable>
            </View>
            <FlatList
              data={outline.length > 0 ? outline : [{ title: 'Aucune table des matières disponible', page: 0 }]}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <Pressable
                  className={`px-5 py-4 border-b border-gray-100 ${item.page === 0 ? 'opacity-50' : ''}`}
                  disabled={item.page === 0}
                >
                  <Text className={`text-sm ${item.page > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                    {item.title}
                  </Text>
                  {item.page > 0 && (
                    <Text className="text-xs text-gray-400 mt-1">Page {item.page}</Text>
                  )}
                </Pressable>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
