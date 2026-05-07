import { injectAbsolutePaths, wrapHTMLForEPUB } from "@/services/epub/epubPathHelper";
import { cleanAndAuthUrl } from "@/services/urlAuth";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import Constants from 'expo-constants';
import { deleteAsync, documentDirectory, downloadAsync } from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useSelector } from "react-redux";
import { RootState } from "../../../../services/redux/store";

const IS_DEV = process.env.NODE_ENV === "development";

type ContentType =
  | "html"
  | "pdf"
  | "epub"
  | "audio"
  | "video"
  | "image"
  | "unknown";

interface DetectedContent {
  type: ContentType;
  url: string;
  filename: string;
  mimeType?: string;
}

const styles = StyleSheet.create({
  bgwhite_rounded2xl_p4_shadowlg: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16
  },
  flex1: {
    flex: 1
  },
  flex1_bgblack: {
    backgroundColor: '#000000',
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
  flex1_fontbold_ml2: {
    flex: 1,
    fontWeight: '700',
    marginLeft: 8
  },
  flex1_itemscenter_justifycente: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  flexrow_itemscenter: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  flexrow_itemscenter_justifybet: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 16
  },
  flexrow_justifybetween: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  h2_bggray200_roundedfull_overf: {
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    height: 8,
    marginBottom: 8,
    overflow: 'hidden'
  },
  hfull_bg4a90e2_roundedfull: {
    backgroundColor: '#4a90e2',
    borderRadius: 9999,
    height: '100%'
  },
  mt4_textgray500: {
    color: '#6B7280',
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
    flex: 1
  },
  style_10: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  style_11: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_12: {
    color: '#6B7280',
    marginTop: 16
  },
  style_2: {
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    height: 56,
    justifyContent: 'center',
    width: 56
  },
  style_3: {
    color: '#6B7280',
    fontSize: 12
  },
  style_4: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  style_5: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  style_6: {
    flex: 1
  },
  style_7: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  style_8: {
    color: '#374151',
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center'
  },
  style_9: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  textbase_fontbold_textgray900: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700'
  },
  textcenter_textgray500_textsm_: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center'
  },
  textgray400_textxs_mt2: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8
  },
  textgray500_fontmedium_textsm: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500'
  },
  textgray500_textsm_mt2: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8
  },
  textgray500_textsm_mt2_textcen: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  textgray500_textxs: {
    color: '#6B7280',
    fontSize: 12
  },
  textgray700_fontbold_mt4: {
    color: '#374151',
    fontWeight: '700',
    marginTop: 16
  },
  textgray700_fontbold_mt4_textc: {
    color: '#374151',
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center'
  },
  textgray700_fontbold_textlg_te: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 32,
    textAlign: 'center'
  },
  textxs_fontmedium_uppercase: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase'
  },
  w14_h14_roundedfull_bggray200_: {
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    height: 56,
    justifyContent: 'center',
    marginLeft: 24,
    opacity: 0.5,
    width: 56
  },
  w20_h20_roundedfull_bg002366_i: {
    alignItems: 'center',
    backgroundColor: '#002366',
    borderRadius: 9999,
    height: 80,
    justifyContent: 'center',
    width: 80
  },
  w36_h36_roundedfull_bgwhite_it: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    justifyContent: 'center'
  },
  w48_h48_roundedfull_bggradient: {
    alignItems: 'center',
    borderRadius: 9999,
    height: 192,
    justifyContent: 'center',
    width: 192
  },
  wfull_maxwsm_mb8: {
    marginBottom: 32,
    width: '100%'
  },
});

export default function UnifiedContentViewer() {
  const router = useRouter();
  const {
    moduleTitle,
    contentUrl,
    contentType,
    fileUrl,
  } = useLocalSearchParams<{
    moduleId?: string;
    courseId?: string;
    moduleTitle?: string;
    contentUrl?: string;
    contentType?: string;
    fileUrl?: string;
    lessonInstance?: string;
  }>();

  const token = useSelector((state: RootState) => state.auth.token);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [detectedContent, setDetectedContent] =
    useState<DetectedContent | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [pdfLocalPath, setPdfLocalPath] = useState<string | null>(null);
  const [epubData, setEpubData] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer(audioUri);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const [epubChapters, setEpubChapters] = useState<any[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [opfDirectory, setOpfDirectory] = useState<string>("");

  const detectContentType = useCallback(
    (filename: string, mimeType?: string, url?: string): ContentType => {
      const lower = (filename || "").toLowerCase();
      const lowerMime = (mimeType || "").toLowerCase();

      if (lower.endsWith(".pdf") || lowerMime.includes("pdf")) return "pdf";
      if (lower.endsWith(".epub") || lower.endsWith(".epub+zip")) return "epub";
      if (lower.match(/\.(mp3|wav|ogg|m4a)$/) || lowerMime.includes("audio"))
        return "audio";
      if (lower.match(/\.(mp4|webm|m4v)$/) || lowerMime.includes("video"))
        return "video";
      if (
        lower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/) ||
        lowerMime.includes("image")
      )
        return "image";
      if (
        lower.endsWith(".html") ||
        lower.endsWith(".htm") ||
        lower.endsWith(".xhtml") ||
        lowerMime.includes("html")
      )
        return "html";

      if (url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes(".pdf") || lowerMime.includes("pdf"))
          return "pdf";
        if (urlLower.includes(".epub")) return "epub";
        if (urlLower.match(/\.(mp3|wav|ogg|m4a)(\?|$)/)) return "audio";
        if (urlLower.match(/\.(mp4|webm|m4v)(\?|$)/)) return "video";
        if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/))
          return "image";
      }

      return "html";
    },
    [],
  );

  const fetchHtmlContent = async (url: string): Promise<string | null> => {
    const authUrl = cleanAndAuthUrl(url, token);
    if (IS_DEV) console.log("[UnifiedViewer] Fetching HTML:", authUrl);

    try {
      const response = await fetch(authUrl);
      const text = await response.text();

      if (IS_DEV)
        console.log(
          "[UnifiedViewer] HTML Response status:",
          response.status,
          "Length:",
          text.length,
        );

      if (
        text.includes('"exception"') ||
        text.includes('"error"') ||
        text.includes("accessexception") ||
        text.includes("Exception du contr")
      ) {
        if (IS_DEV) {
          console.warn(
            "[UnifiedViewer] HTML is error response:",
            text.substring(0, 300),
          );
        }
        return null;
      }

      if (
        text.includes("<!DOCTYPE html") ||
        text.includes("<html") ||
        text.includes("<body")
      ) {
        if (IS_DEV) console.log("[UnifiedViewer] Valid HTML received");
        return text;
      }

      if (text.length > 100) {
        if (IS_DEV)
          console.log("[UnifiedViewer] Content received, treating as text");
        return text;
      }

      return null;
    } catch (err) {
      if (IS_DEV) console.error("[UnifiedViewer] HTML fetch error:", err);
      return null;
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const targetUrl = fileUrl || contentUrl;

      if (!targetUrl) {
        setError("URL manquante");
        setLoading(false);
        return;
      }

      try {
        const urlLower = targetUrl.toLowerCase();
        const isViewPhp = urlLower.includes("/view.php?id=");

        if (IS_DEV)
          console.log("[UnifiedViewer] URL analysis:", {
            isViewPhp,
            url: targetUrl,
          });

        if (isViewPhp) {
          if (
            urlLower.includes("/mod/lesson/") ||
            urlLower.includes("/mod/page/")
          ) {
            if (IS_DEV)
              console.log(
                "[UnifiedViewer] Detected lesson/page module",
              );
            setError(
              "Ce type de contenu s'ouvre depuis le cours principal.",
            );
            setLoading(false);
            return;
          }

          if (urlLower.includes("/mod/forum/")) {
            if (IS_DEV) console.log("[UnifiedViewer] Detected forum module");
            setError(
              "Ce forum n'est pas accessible depuis l'application.",
            );
            setLoading(false);
            return;
          }

          if (urlLower.includes("/mod/quiz/")) {
            if (IS_DEV) console.log("[UnifiedViewer] Detected quiz module");
            setError("Ce quiz doit être fait depuis Moodle.");
            setLoading(false);
            return;
          }
        }

        const filename = targetUrl.split("/").pop()?.split("?")[0] || "document";
        const type = detectContentType(filename, contentType, targetUrl);

        if (IS_DEV)
          console.log("[UnifiedViewer] Type:", type, "| URL:", targetUrl);

        setDetectedContent({
          type,
          url: targetUrl,
          filename,
          mimeType: contentType,
        });

        switch (type) {
          case "html":
            const html = await fetchHtmlContent(targetUrl);
            if (html) {
              setHtmlContent(html);
            } else {
              setError(
                "Impossible de charger le contenu HTML.",
              );
            }
            break;

          case "image":
            setImageUri(cleanAndAuthUrl(targetUrl, token));
            break;

          case "audio":
            setAudioUri(cleanAndAuthUrl(targetUrl, token));
            break;

          case "video":
            setVideoUri(cleanAndAuthUrl(targetUrl, token));
            break;

          case "pdf":
            await downloadPdf(targetUrl);
            break;

          case "epub":
            await downloadAndParseEpub(targetUrl);
            break;

          default:
            const fallbackHtml = await fetchHtmlContent(targetUrl);
            if (fallbackHtml) {
              setHtmlContent(fallbackHtml);
            } else {
              setError(
                "Type de contenu non supporté.",
              );
            }
        }
      } catch (err: any) {
        if (IS_DEV) console.error("[UnifiedViewer] Error:", err);
        setError(err.message || "Erreur");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [contentUrl, fileUrl, contentType, detectContentType, token]);

  const downloadPdf = async (url: string) => {
    const processedUrl = cleanAndAuthUrl(url, token);
    
    if (IS_DEV)
      console.log("[UnifiedViewer] Downloading PDF:", processedUrl);
    
    try {
      const filename = `pdf_${Date.now()}.pdf`;
      const localUri = `${documentDirectory}${filename}`;
      const result = await downloadAsync(processedUrl, localUri);
      
      if (result.status === 200) {
        if (IS_DEV)
          console.log("[UnifiedViewer] PDF downloaded to:", localUri);
        setPdfLocalPath(localUri);
      } else {
        if (IS_DEV)
          console.warn(
            "[UnifiedViewer] PDF download failed:",
            result.status,
          );
        setError("Impossible de télécharger le PDF");
      }
    } catch (err: any) {
      if (IS_DEV)
        console.error("[UnifiedViewer] PDF download error:", err);
      setError(err.message || "Erreur lors du téléchargement du PDF");
    }
  };

  const epubDataRef = useRef<{ bookId: number; currentChapter: number; totalChapters: number; localPath: string } | null>(null);
  const [epubLocalPath, setEpubLocalPath] = useState<string | null>(null);

  const downloadAndParseEpub = async (url: string) => {
    if (IS_DEV)
      console.log("[UnifiedViewer] Loading EPUB:", url);
    
    try {
      const epubLoader = await import('../../../../services/epub/epubLoader');
      
      const result = await epubLoader.loadEPUB(url, token || undefined);
      
      if (IS_DEV) {
        console.log("[UnifiedViewer] EPUB loaded:", result.parsed.title || 'Untitled');
        console.log("[UnifiedViewer] Chapters:", result.chapters.length);
        console.log("[UnifiedViewer] Offline:", result.isOffline);
        console.log("[UnifiedViewer] Local path:", result.localPath);
      }
      
      if (result.chapters.length > 0) {
        setEpubChapters(result.chapters);
        setOpfDirectory(result.parsed.opfDir);
        setCurrentChapterIndex(0);
        
        const chapterContent = result.chapters[0].content;
        const normalizedContent = injectAbsolutePaths(chapterContent, result.parsed.opfDir);
        const wrappedHtml = wrapHTMLForEPUB(normalizedContent, result.parsed.opfDir);
        
        setHtmlContent(wrappedHtml);
        setEpubLocalPath(result.localPath);
        
        epubDataRef.current = {
          bookId: result.bookId,
          currentChapter: 0,
          totalChapters: result.chapters.length,
          localPath: result.localPath,
        };
        
        setEpubData(JSON.stringify({
          bookId: result.bookId,
          currentChapter: 0,
          totalChapters: result.chapters.length,
          title: result.parsed.title,
          isOffline: result.isOffline,
          localPath: result.localPath,
          sourceUrl: url,
        }));
        
        if (IS_DEV)
          console.log("[UnifiedViewer] First chapter displayed from", result.isOffline ? "offline storage" : "new download");
      } else {
        setError("Aucun chapitre trouvé dans l'EPUB");
      }
      
    } catch (err: any) {
      if (IS_DEV)
        console.error("[UnifiedViewer] EPUB error:", err);
      setError(err.message || "Erreur lors du chargement de l'EPUB");
    }
  };

  useEffect(() => {
    if (audioPlayer) {
      const statusInterval = setInterval(() => {
        setIsPlaying(audioPlayer.playing);
        setPosition(audioPlayer.currentTime * 1000);
        setAudioDuration(audioPlayer.duration * 1000);
      }, 500);
      return () => clearInterval(statusInterval);
    }
  }, [audioPlayer]);

  useEffect(() => {
    return () => {
      // Audio cleanup is mostly handled by the hook, but we pause just in case
      if (audioPlayer) {
        try {
          audioPlayer.pause();
        } catch {
          // Player may already be released by expo-audio on unmount — safe to ignore
        }
      }
    };
  }, [audioPlayer]);

  const togglePlayPause = async () => {
    if (!audioPlayer) return;
    try {
      if (isPlaying) {
        audioPlayer.pause();
      } else {
        audioPlayer.play();
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      if (IS_DEV) console.error("[UnifiedViewer] Play/Pause error:", err);
    }
  };

  const restartAudio = async () => {
    if (!audioPlayer) return;
    try {
      await audioPlayer.seekTo(0);
      audioPlayer.play();
    } catch (err) {
      if (IS_DEV) console.error("[UnifiedViewer] Restart error:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    return () => {
      if (pdfLocalPath) {
        deleteAsync(pdfLocalPath, { idempotent: true }).catch(() => {});
      }
    };
  }, [pdfLocalPath]);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "external") {
        Alert.alert("Lien externe", "Ce lien ne peut pas être ouvert.");
      }
    } catch {}
  };

  const loadChapter = (index: number) => {
    try {
      if (!epubChapters || !epubChapters[index]) {
        console.warn("[UnifiedViewer] Chapter " + index + " not found");
        return;
      }
      const chapterContent = epubChapters[index].content;
      if (!chapterContent) {
         console.warn("[UnifiedViewer] Chapter " + index + " has no content");
         return;
      }
      const normalizedContent = injectAbsolutePaths(chapterContent, opfDirectory || "");
      const wrappedHtml = wrapHTMLForEPUB(normalizedContent, opfDirectory || "");
      
      setHtmlContent(wrappedHtml);
      setCurrentChapterIndex(index);
      if (epubDataRef.current) epubDataRef.current.currentChapter = index;
    } catch (err: any) {
      if (IS_DEV) console.error("[UnifiedViewer] loadChapter error:", err);
      Alert.alert("Erreur de chapitre", err.message || "Impossible de charger ce chapitre");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.flex1_bgFAF9F6_itemscenter_jus}>
        <ActivityIndicator size="large" color="#002366" />
        <Text style={styles.style_12}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.style_11} edges={["top"]}>
        <View style={styles.style_10}>
          <Pressable onPress={() => router.back()} style={styles.p2}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.flex1_fontbold_ml2}>
            {moduleTitle || "Erreur"}
          </Text>
        </View>
        <View style={styles.style_9}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.style_8}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detectedContent) return null;

  const renderContent = () => {
    switch (detectedContent.type) {
      case "html":
        return (
          <WebView
            source={{ html: htmlContent }}
            style={{ flex: 1 }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={["*"]}
            scalesPageToFit={true}
          />
        );

      case "image":
        return (
          <ScrollView
            contentContainerStyle={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 16,
            }}
          >
            {imageUri && (
              <View style={styles.bgwhite_rounded2xl_p4_shadowlg}>
                <Text style={styles.textcenter_textgray500_textsm_}>
                  {detectedContent.filename}
                </Text>
                <WebView
                  source={{ uri: imageUri }}
                  style={{
                    width: Dimensions.get("window").width - 64,
                    height: Dimensions.get("window").height * 0.7,
                  }}
                  scalesPageToFit={true}
                  scrollEnabled={false}
                />
              </View>
            )}
          </ScrollView>
        );

      case "video":
        const videoHtml = videoUri ? `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { margin: 0; background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
              video { width: 100%; max-height: 100vh; }
            </style>
          </head>
          <body>
            <video controls>
              <source src="${videoUri}" type="video/mp4">
            </video>
          </body>
          </html>
        ` : '';
        return (
          <View style={styles.flex1_bgblack}>
            {videoUri && (
              <WebView
                source={{ html: videoHtml }}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                allowsFullscreenVideo={true}
              />
            )}
          </View>
        );

      case "pdf":
        if (pdfLocalPath) {
          const authPdfUrl = detectedContent.url ? cleanAndAuthUrl(detectedContent.url, token) : null;
          if (!authPdfUrl) return null;

          const isExpoGo = Constants.appOwnership === 'expo';
          
          if (isExpoGo) {
            // Expo Go doesn't support react-native-pdf (native module)
            // Use Google Docs PDF viewer as fallback
            const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(authPdfUrl)}&embedded=true`;
            return (
              <WebView
                source={{ uri: googleViewerUrl }}
                style={{ flex: 1 }}
                originWhitelist={["*"]}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
            );
          }

          // For native builds, dynamically import react-native-pdf
          const PdfViewer = require('react-native-pdf').default;
          return (
            <View style={styles.flex1_bggray100}>
              <PdfViewer
                source={{ uri: authPdfUrl, cache: true }}
                style={{
                  flex: 1,
                  width: Dimensions.get("window").width,
                  height: Dimensions.get("window").height,
                }}
                onLoadComplete={(numberOfPages: number) => {
                  if (IS_DEV) console.log(`[UnifiedViewer] PDF loaded with ${numberOfPages} pages`);
                }}
                onError={(err: any) => {
                  if (IS_DEV) console.error("[UnifiedViewer] PDF error:", err);
                  setError("Erreur lors de l'affichage du PDF");
                }}
              />
            </View>
          );
        }
        return (
          <View style={styles.style_7}>
            <ActivityIndicator size="large" color="#002366" />
            <Text style={styles.mt4_textgray500}>Traitement du PDF...</Text>
            <Text style={styles.textgray400_textxs_mt2}>Téléchargement...</Text>
          </View>
        );

      case "epub":
        if (htmlContent) {
          const webViewBaseUrl = epubLocalPath ? (epubLocalPath.endsWith('/') ? epubLocalPath : epubLocalPath + '/') : undefined;
          if (IS_DEV && webViewBaseUrl) {
            console.log("[UnifiedViewer] EPUB WebView baseUrl:", webViewBaseUrl);
          }
          return (
            <View style={styles.style_6}>
              <WebView
                key={`webview-${currentChapterIndex}`}
                source={{ html: htmlContent, baseUrl: webViewBaseUrl }}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={["*"]}
                scalesPageToFit={true}
                onMessage={handleWebViewMessage}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
                allowFileAccessFromFileURLs={true}
                mixedContentMode="always"
              />
              {epubChapters.length > 1 && (
                <View style={styles.flexrow_itemscenter_justifybet}>
                  <Pressable
                    onPress={() => loadChapter(currentChapterIndex - 1)}
                    disabled={currentChapterIndex === 0}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: currentChapterIndex === 0 ? '#E5E7EB' : '#002366'
                    }}
                  >
                    <Text style={{ color: currentChapterIndex === 0 ? '#9CA3AF' : '#FFFFFF' }}>Précédent</Text>
                  </Pressable>
                  <Text style={styles.textgray500_fontmedium_textsm}>
                    {currentChapterIndex + 1} / {epubChapters.length}
                  </Text>
                  <Pressable
                    onPress={() => loadChapter(currentChapterIndex + 1)}
                    disabled={currentChapterIndex === epubChapters.length - 1}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: currentChapterIndex === epubChapters.length - 1 ? '#E5E7EB' : '#002366'
                    }}
                  >
                    <Text style={{ color: currentChapterIndex === epubChapters.length - 1 ? '#9CA3AF' : '#FFFFFF' }}>Suivant</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }
        return (
          <View style={styles.style_5}>
            <ActivityIndicator size="large" color="#002366" />
            <Text style={styles.textgray700_fontbold_mt4_textc}>
              {detectedContent.filename}
            </Text>
            <Text style={styles.textgray500_textsm_mt2_textcen}>
              Chargement de l&apos;EPUB...
            </Text>
          </View>
        );

      case "audio":
        const progress = audioDuration > 0 ? (position / audioDuration) * 100 : 0;
        return (
          <View style={styles.style_4}>
            <View style={styles.w48_h48_roundedfull_bggradient}>
              <View style={styles.w36_h36_roundedfull_bgwhite_it}>
                <Ionicons name="musical-notes" size={56} color="#002366" />
              </View>
            </View>

            <Text style={styles.textgray700_fontbold_textlg_te}>
              {detectedContent.filename}
            </Text>

            <View style={styles.wfull_maxwsm_mb8}>
              <View style={styles.h2_bggray200_roundedfull_overf}>
                <View
                  style={[styles.hfull_bg4a90e2_roundedfull,{ width: `${progress}%` }]}
                 />
              </View>
              <View style={styles.flexrow_justifybetween}>
                <Text style={styles.style_3}>
                  {formatTime(position / 1000)}
                </Text>
                <Text style={styles.textgray500_textxs}>
                  {formatTime(audioDuration / 1000)}
                </Text>
              </View>
            </View>

            <View style={styles.flexrow_itemscenter}>
              <Pressable
                onPress={restartAudio}
                style={styles.style_2}
              >
                <Feather name="rotate-ccw" size={24} color="#002366" />
              </Pressable>
              <Pressable
                onPress={togglePlayPause}
                style={styles.w20_h20_roundedfull_bg002366_i}
              >
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={32}
                  color="white"
                />
              </Pressable>
              <View style={styles.w14_h14_roundedfull_bggray200_}>
                <Feather name="skip-forward" size={24} color="#9CA3AF" />
              </View>
            </View>
          </View>
        );

      default:
        return (
          <View style={styles.flex1_itemscenter_justifycente}>
            <Feather name="file" size={64} color="#9CA3AF" />
            <Text style={styles.textgray700_fontbold_mt4}>
              {detectedContent.filename}
            </Text>
            <Text style={styles.textgray500_textsm_mt2}>
              Type: {detectedContent.type}
            </Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={["top"]}>
      <View style={styles.px4_py3_flexrow_itemscenter_bg}>
        <Pressable onPress={() => router.back()} style={styles.p2_mr2}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View style={styles.style_1}>
          <Text style={styles.textbase_fontbold_textgray900} numberOfLines={1}>
            {moduleTitle || "Contenu"}
          </Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 9999,
              marginTop: 4,
              backgroundColor: detectedContent.type === "pdf"
                ? '#FEE2E2'
                : detectedContent.type === "epub"
                  ? '#DCFCE7'
                  : detectedContent.type === "audio"
                    ? '#F3E8FF'
                    : detectedContent.type === "video"
                      ? '#FFEDD5'
                      : '#DBEAFE'
            }}
          >
            <Text style={styles.textxs_fontmedium_uppercase}>
              {detectedContent.type}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.flex1}>{renderContent()}</View>
    </SafeAreaView>
  );
}
