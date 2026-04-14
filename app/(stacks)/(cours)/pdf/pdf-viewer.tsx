import { Feather } from "@expo/vector-icons";
import React, { useState, useCallback } from "react";
import { Pressable, Text, View, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "@/services/redux/store";
import { documentDirectory, downloadAsync, deleteAsync } from "expo-file-system";

const IS_DEV = process.env.NODE_ENV === "development";

export default function PdfViewerScreen() {
  const router = useRouter();
  const { pdfUrl, title } = useLocalSearchParams<{ pdfUrl?: string; title?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);

  const getAuthToken = () => {
    return token && token.length > 10 ? token : '';
  };

  const cleanAndAuthUrl = (url: string): string => {
    const authToken = getAuthToken();
    if (!url) return url;
    
    let cleaned = url.replace(/[?&]forceddownload=1/gi, '').replace(/[?&]download=1/gi, '');
    
    if (cleaned.includes('token=') || cleaned.includes('wstoken=')) {
      return cleaned;
    }
    
    if (!authToken) return cleaned;
    
    const separator = cleaned.includes('?') ? '&' : '?';
    
    if (cleaned.includes('pluginfile.php')) {
      return `${cleaned}${separator}token=${authToken}`;
    }
    return `${cleaned}${separator}wstoken=${authToken}`;
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

      const authUrl = cleanAndAuthUrl(pdfUrl);
      const filename = `temp_${Date.now()}.pdf`;
      const localUri = `${documentDirectory}${filename}`;

      const downloadResult = await downloadAsync(authUrl, localUri);
      
      if (downloadResult.status === 200) {
        if (IS_DEV) console.log('[PdfViewer] PDF downloaded to:', localUri);
        setLocalPath(localUri);
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
        <Text className="flex-1 text-base font-bold text-gray-900" numberOfLines={1}>
          {title || 'Document PDF'}
        </Text>
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
    </SafeAreaView>
  );
}
