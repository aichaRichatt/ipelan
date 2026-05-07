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
      <SafeAreaView style={styles.flex1_bgFAF9F6_itemscenter_jus}>
        <Feather name="file" size={64} color="#D1D5DB" />
        <Text style={styles.mt4_textgray500}>URL PDF manquante</Text>
        <Pressable onPress={() => router.back()} style={styles.mt4_px6_py3_bg002366_roundedxl}>
          <Text style={styles.style_1}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const authenticatedUrl = cleanAndAuthUrl(pdfUrl, token || "");
  const source = { uri: authenticatedUrl, cache: true };

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={["top"]}>
      <View style={styles.px4_py3_flexrow_itemscenter_bg}>
        <Pressable onPress={() => router.back()} style={styles.p2_mr2}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.textbase_fontbold_textgray900} numberOfLines={1}>
            {title || 'Document PDF'}
          </Text>
          {totalPages > 0 && (
            <Text style={styles.textxs_textgray500}>
              Page {currentPage} / {totalPages}
            </Text>
          )}
        </View>
        <Pressable onPress={handleOpenExternal} style={styles.p2}>
          <Feather name="external-link" size={24} color="#002366" />
        </Pressable>
      </View>

      <View style={styles.flex1_bggray100}>
        {Constants.appOwnership === 'expo' ? (
          // Sur Expo Go : react-native-pdf n'est pas disponible.
          // On affiche le PDF via WebView directement (pas Google Docs, pour ne pas
          // envoyer des URLs authentifiées vers un service tiers).
          <WebView
            source={{ uri: authenticatedUrl }}
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
                  <View style={styles.itemscenter_justifycenter_p10}>
                    <ActivityIndicator size="large" color="#002366" />
                    <Text style={styles.mt4_textgray600}>Chargement du PDF...</Text>
                  </View>
                )}
              />
            );
          })()
        )}
      </View>

      {error && (
        <View style={styles.absolute_inset0_bgFAF9F6_items}>
          <Feather name="alert-triangle" size={64} color="#EF4444" />
          <Text style={styles.textgray500_mt4_textcenter}>Erreur de chargement</Text>
          <Text style={styles.textgray400_textsm_mt2_textcen}>{error}</Text>
          <Pressable
            onPress={handleOpenExternal}
            style={styles.bg002366_px6_py3_roundedxl}
          >
            <Text style={styles.textwhite_fontbold}>Ouvrir dans le navigateur</Text>
          </Pressable>
          <Pressable
            onPress={() => setError(null)}
            style={styles.mt4_p2}
          >
            <Text style={styles.textblue600_fontsemibold}>Réessayer</Text>
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
  },
  absolute_inset0_bgFAF9F6_items: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 20,
    position: 'absolute',
    right: 0,
    top: 0
  },
  bg002366_px6_py3_roundedxl: {
    backgroundColor: '#002366',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  flex1: {
    flex: 1
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flex1_bgFAF9F6_itemscenter_jus: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flex: 1,
    justifyContent: 'center'
  },
  flex1_bggray100: {
    backgroundColor: '#F3F4F6',
    flex: 1
  },
  itemscenter_justifycenter_p10: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  mt4_p2: {
    marginTop: 16,
    padding: 8
  },
  mt4_px6_py3_bg002366_roundedxl: {
    backgroundColor: '#002366',
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  mt4_textgray500: {
    color: '#6B7280',
    marginTop: 16
  },
  mt4_textgray600: {
    color: '#4B5563',
    marginTop: 16
  },
  p2: {
    padding: 8
  },
  p2_mr2: {
    marginRight: 8,
    padding: 8
  },
  px4_py3_flexrow_itemscenter_bg: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  style_1: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  textbase_fontbold_textgray900: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700'
  },
  textblue600_fontsemibold: {
    color: '#2563EB',
    fontWeight: '600'
  },
  textgray400_textsm_mt2_textcen: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 24,
    marginTop: 8,
    textAlign: 'center'
  },
  textgray500_mt4_textcenter: {
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center'
  },
  textwhite_fontbold: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  textxs_textgray500: {
    color: '#6B7280',
    fontSize: 12
  },
});
