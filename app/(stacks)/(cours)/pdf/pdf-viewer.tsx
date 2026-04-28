import { RootState } from "@/services/redux/store";
import { cleanAndAuthUrl } from "@/services/urlAuth";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useSelector } from "react-redux";

const IS_DEV = process.env.NODE_ENV === "development";
const CORS_PROXY = "https://corsproxy.io/?";

interface PdfPage {
  pageNum: number;
  dataUrl: string;
}

export default function PdfViewerScreen() {
  const router = useRouter();
  const { pdfUrl, title } = useLocalSearchParams<{ pdfUrl?: string; title?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (pdfUrl && token) {
      const authUrl = cleanAndAuthUrl(pdfUrl, token);
      const proxyUrl = CORS_PROXY + encodeURIComponent(authUrl);
      
      if (IS_DEV) console.log('[PdfViewer] Loading PDF via proxy:', proxyUrl);
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
          <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
              background: #f5f5f5;
              padding: 10px;
            }
            .page-container { 
              margin-bottom: 15px; 
              background: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              border-radius: 8px;
              overflow: hidden;
            }
            canvas { 
              display: block; 
              width: 100%;
              height: auto;
            }
            .page-num { 
              background: #002366; 
              color: white; 
              padding: 8px;
              text-align: center;
              font-size: 12px;
            }
            #loading {
              text-align: center;
              padding: 40px;
              color: #666;
            }
            .error {
              color: #dc2626;
              padding: 20px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div id="loading">Chargement du PDF...</div>
          <div id="pages"></div>
          
          <script>
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            
            let extractedPages = [];
            
            async function loadPdf() {
              try {
                const loadingTask = pdfjsLib.getDocument('${proxyUrl}');
                const pdf = await loadingTask.promise;
                const numPages = pdf.numPages;
                
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'pageCount',
                  count: numPages
                }));
                
                document.getElementById('loading').style.display = 'none';
                
                for (let i = 1; i <= numPages; i++) {
                  const page = await pdf.getPage(i);
                  const scale = window.innerWidth / page.getViewport({ scale: 1 }).width * 1.5;
                  const viewport = page.getViewport({ scale });
                  
                  const canvas = document.createElement('canvas');
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  
                  const context = canvas.getContext('2d');
                  await page.render({
                    canvasContext: context,
                    viewport: viewport
                  }).promise;
                  
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                  extractedPages.push({ pageNum: i, dataUrl });
                  
                  const pageDiv = document.createElement('div');
                  pageDiv.className = 'page-container';
                  pageDiv.innerHTML = '<div class="page-num">Page ' + i + ' / ' + numPages + '</div>';
                  const img = document.createElement('img');
                  img.src = dataUrl;
                  img.style.width = '100%';
                  img.style.height = 'auto';
                  pageDiv.appendChild(img);
                  document.getElementById('pages').appendChild(pageDiv);
                  
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'pageLoaded',
                    page: i,
                    total: numPages
                  }));
                }
                
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'complete',
                  pages: extractedPages
                }));
                
              } catch (err) {
                document.getElementById('loading').innerHTML = '<div class="error">Erreur: ' + err.message + '</div>';
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'error',
                  message: err.message
                }));
              }
            }
            
            loadPdf();
          </script>
        </body>
        </html>
      `;
      
      setPdfHtml(html);
    }
  }, [pdfUrl, token]);

  const [pdfHtml, setPdfHtml] = useState<string | null>(null);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (IS_DEV) console.log('[PdfViewer] WebView message:', data.type);
      
      if (data.type === 'pageCount') {
        setTotalPages(data.count);
      } else if (data.type === 'pageLoaded') {
        if (IS_DEV) console.log(`[PdfViewer] Page ${data.page}/${data.total} loaded`);
      } else if (data.type === 'complete') {
        setPages(data.pages);
        setIsLoading(false);
      } else if (data.type === 'error') {
        setError(data.message);
        setIsLoading(false);
      }
    } catch (err) {
      if (IS_DEV) console.error('[PdfViewer] Message parse error:', err);
    }
  };

  const handleOpenExternal = () => {
    if (pdfUrl) {
      const authUrl = cleanAndAuthUrl(pdfUrl, token || '');
      Linking.openURL(authUrl);
    }
  };

  if (!pdfUrl) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6] items-center justify-center">
        <Feather name="file" size={64} color="#D1D5DB" />
        <Text className="mt-4 text-gray-500">URL PDF manquante</Text>
        <Pressable onPress={() => router.back()} className="mt-4 px-6 py-3 bg-[#002366] rounded-xl">
          <Text className="text-white font-bold">Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isLoading && !pdfHtml) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6] items-center justify-center">
        <ActivityIndicator size="large" color="#002366" />
        <Text className="mt-4 text-gray-600">Chargement du PDF...</Text>
        <Text className="mt-2 text-gray-400 text-xs">Préparation de la visionneuse</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={["top"]}>
        <View className="px-5 py-4 flex-row items-center bg-white border-b border-gray-200">
          <Pressable onPress={() => router.back()} className="mr-4 p-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold flex-1" numberOfLines={1}>{title || 'PDF'}</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Feather name="file-text" size={64} color="#D1D5DB" />
          <Text className="text-gray-500 mt-4 text-center">Erreur de chargement</Text>
          <Text className="text-gray-400 text-sm mt-2 text-center mb-6">{error}</Text>
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
            <Text className="text-xs text-gray-500">
              {pages.length}/{totalPages} pages chargées
            </Text>
          )}
        </View>
        <Pressable onPress={handleOpenExternal} className="p-2">
          <Feather name="external-link" size={24} color="#002366" />
        </Pressable>
      </View>

      {isLoading && pdfHtml && (
        <View className="absolute top-20 left-0 right-0 z-10 items-center">
          <View className="bg-white px-4 py-2 rounded-full shadow-md flex-row items-center">
            <ActivityIndicator size="small" color="#002366" className="mr-2" />
            <Text className="text-sm text-gray-600">Chargement des pages...</Text>
          </View>
        </View>
      )}

      {pdfHtml && (
        <WebView
          ref={webViewRef}
          source={{ html: pdfHtml, baseUrl: 'https://ipelan.mr' }}
          style={{ flex: 1, backgroundColor: '#f5f5f5' }}
          onMessage={handleWebViewMessage}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={false}
          scalesPageToFit={true}
          bounces={true}
          showsVerticalScrollIndicator={true}
        />
      )}
    </SafeAreaView>
  );
}
