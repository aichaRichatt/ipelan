import { RootState } from "@/services/redux/store";
import { cleanAndAuthUrl } from "@/services/urlAuth";
import { Feather } from "@expo/vector-icons";
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Dimensions, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useSelector } from "react-redux";

const IS_DEV = process.env.NODE_ENV === "development";

export default function PdfViewerScreen() {
  const router = useRouter();
  const { pdfUrl, title } = useLocalSearchParams<{ pdfUrl?: string; title?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const handleOpenExternal = () => {
    if (pdfUrl && token) {
      const authUrl = cleanAndAuthUrl(pdfUrl, token);
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

  const authenticatedUrl = cleanAndAuthUrl(pdfUrl, token || "");
  const source = { uri: authenticatedUrl, cache: true };

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
              Page {currentPage} / {totalPages}
            </Text>
          )}
        </View>
        <Pressable onPress={handleOpenExternal} className="p-2">
          <Feather name="external-link" size={24} color="#002366" />
        </Pressable>
      </View>

      <View className="flex-1 bg-gray-100">
        {Constants.appOwnership === 'expo' ? (
          <WebView
            source={{ uri: `https://docs.google.com/viewer?url=${encodeURIComponent(authenticatedUrl)}&embedded=true` }}
            style={{ flex: 1 }}
            onLoad={() => setIsLoading(false)}
            onError={(err) => {
              setError(err.nativeEvent.description);
              setIsLoading(false);
            }}
          />
        ) : (
          (() => {
            const Pdf = require('react-native-pdf').default;
            return (
              <Pdf
                source={source}
                onLoadComplete={(numberOfPages: number) => {
                  setTotalPages(numberOfPages);
                  setIsLoading(false);
                  if (IS_DEV) console.log(`[PdfViewer] Loaded PDF with ${numberOfPages} pages`);
                }}
                onPageChanged={(page: number) => {
                  setCurrentPage(page);
                }}
                onError={(err: any) => {
                  setError(err.toString());
                  setIsLoading(false);
                  if (IS_DEV) console.error('[PdfViewer] PDF Error:', err);
                }}
                onPressLink={(uri: string) => {
                  if (IS_DEV) console.log(`[PdfViewer] Link pressed: ${uri}`);
                  Linking.openURL(uri);
                }}
                style={styles.pdf}
                renderActivityIndicator={() => (
                  <View className="items-center justify-center p-10">
                    <ActivityIndicator size="large" color="#002366" />
                    <Text className="mt-4 text-gray-600">Chargement du PDF...</Text>
                  </View>
                )}
              />
            );
          })()
        )}
      </View>

      {error && (
        <View className="absolute inset-0 bg-[#FAF9F6] items-center justify-center px-5">
          <Feather name="alert-triangle" size={64} color="#EF4444" />
          <Text className="text-gray-500 mt-4 text-center">Erreur de chargement</Text>
          <Text className="text-gray-400 text-sm mt-2 text-center mb-6">{error}</Text>
          <Pressable
            onPress={handleOpenExternal}
            className="bg-[#002366] px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Ouvrir dans le navigateur</Text>
          </Pressable>
          <Pressable
            onPress={() => setError(null)}
            className="mt-4 p-2"
          >
            <Text className="text-blue-600 font-semibold">Réessayer</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    backgroundColor: '#F3F4F6',
  }
});
