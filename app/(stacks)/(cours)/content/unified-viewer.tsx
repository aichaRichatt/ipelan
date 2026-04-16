import { cleanAndAuthUrl } from "@/services/urlAuth";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Audio, Video } from "expo-av";
import {
  deleteAsync,
  documentDirectory,
  downloadAsync,
  readAsStringAsync,
} from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
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
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [epubData, setEpubData] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

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
            setError("Format EPUB non encore supporté dans cette vue.");
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
        
        // Convertir en base64 pour affichage hors-ligne
        try {
          const base64 = await readAsStringAsync(localUri, { encoding: 'base64' });
          setPdfBase64(base64);
          if (IS_DEV)
            console.log("[UnifiedViewer] PDF encoded to base64");
        } catch (encodeErr) {
          if (IS_DEV)
            console.warn("[UnifiedViewer] Base64 encoding failed:", encodeErr);
        }
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

  useEffect(() => {
    let isMounted = true;

    if (audioUri) {
      const loadAudio = async () => {
        try {
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: audioUri },
            { shouldPlay: false },
            (status) => {
              if (status.isLoaded && isMounted) {
                setPosition(status.positionMillis);
                setDuration(status.durationMillis || 0);
                setIsPlaying(status.isPlaying);
              }
            },
          );
          if (isMounted) setSound(newSound);
        } catch (err) {
          if (IS_DEV) console.error("[UnifiedViewer] Audio error:", err);
        }
      };
      loadAudio();
    }

    return () => {
      isMounted = false;
      if (sound) sound.unloadAsync();
    };
  }, [audioUri, sound]);

  const togglePlayPause = async () => {
    if (!sound) return;
    try {
      if (isPlaying) await sound.pauseAsync();
      else await sound.playAsync();
    } catch (err) {
      if (IS_DEV) console.error("[UnifiedViewer] Play/Pause error:", err);
    }
  };

  const restartAudio = async () => {
    if (!sound) return;
    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch (err) {
      if (IS_DEV) console.error("[UnifiedViewer] Restart error:", err);
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6] items-center justify-center">
        <ActivityIndicator size="large" color="#002366" />
        <Text className="mt-4 text-gray-500">Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={["top"]}>
        <View className="px-4 py-3 flex-row items-center bg-white border-b">
          <Pressable onPress={() => router.back()} className="p-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="flex-1 font-bold ml-2">
            {moduleTitle || "Erreur"}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text className="text-gray-700 font-bold mt-4 text-center">
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
              <View className="bg-white rounded-2xl p-4 shadow-lg">
                <Text className="text-center text-gray-500 text-sm mb-2">
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
        return (
          <View className="flex-1 bg-black">
            {videoUri && (
              <Video
                source={{ uri: videoUri }}
                style={{ flex: 1 }}
                useNativeControls={true}
                shouldPlay={false}
              />
            )}
          </View>
        );

      case "pdf":
        if (pdfBase64) {
          const pdfJsHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
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
              </style>
            </head>
            <body>
              <div id="loading">Chargement du PDF...</div>
              <div id="pages"></div>
              
              <script>
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                
                async function loadPdf() {
                  try {
                    const pdfData = atob('${pdfBase64}');
                    const uint8Array = new Uint8Array(pdfData.length);
                    for (let i = 0; i < pdfData.length; i++) {
                      uint8Array[i] = pdfData.charCodeAt(i);
                    }
                    
                    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
                    const pdf = await loadingTask.promise;
                    const numPages = pdf.numPages;
                    
                    document.getElementById('loading').textContent = numPages + ' pages trouvées';
                    
                    for (let i = 1; i <= numPages; i++) {
                      const page = await pdf.getPage(i);
                      const scale = (window.innerWidth - 20) / page.getViewport({ scale: 1 }).width * 2.5;
                      const viewport = page.getViewport({ scale });
                      
                      const canvas = document.createElement('canvas');
                      canvas.width = viewport.width;
                      canvas.height = viewport.height;
                      
                      const context = canvas.getContext('2d');
                      context.imageSmoothingEnabled = true;
                      context.imageSmoothingQuality = 'high';
                      await page.render({
                        canvasContext: context,
                        viewport: viewport
                      }).promise;
                      
                      const pageDiv = document.createElement('div');
                      pageDiv.className = 'page-container';
                      pageDiv.innerHTML = '<div class="page-num">Page ' + i + ' / ' + numPages + '</div>';
                      const img = document.createElement('img');
                      img.src = canvas.toDataURL('image/png');
                      img.style.width = '100%';
                      img.style.height = 'auto';
                      pageDiv.appendChild(img);
                      document.getElementById('pages').appendChild(pageDiv);
                    }
                    
                    document.getElementById('loading').style.display = 'none';
                    
                  } catch (err) {
                    document.getElementById('loading').textContent = 'Erreur: ' + err.message;
                  }
                }
                
                loadPdf();
              </script>
            </body>
            </html>
          `;
          return (
            <View className="flex-1">
              <WebView
                source={{ html: pdfJsHtml }}
                style={{ flex: 1 }}
                originWhitelist={["*"]}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scalesPageToFit={true}
              />
            </View>
          );
        }
        return (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#002366" />
            <Text className="mt-4 text-gray-500">Traitement du PDF...</Text>
            <Text className="text-gray-400 text-xs mt-2">Téléchargement...</Text>
          </View>
        );

      case "epub":
        return (
          <View className="flex-1 items-center justify-center px-5">
            <Ionicons name="book" size={64} color="#4CAF50" />
            <Text className="text-gray-700 font-bold mt-4 text-center">
              {detectedContent.filename}
            </Text>
            <Text className="text-gray-500 text-sm mt-2 text-center">
              Ouvrez ce fichier depuis le lecteur EPUB
            </Text>
          </View>
        );

      case "audio":
        const progress = duration > 0 ? (position / duration) * 100 : 0;
        return (
          <View className="flex-1 items-center justify-center px-5 bg-[#FAF9F6]">
            <View className="w-48 h-48 rounded-full bg-gradient-to-br from-[#002366] to-[#4a90e2] items-center justify-center mb-12 shadow-xl">
              <View className="w-36 h-36 rounded-full bg-white items-center justify-center">
                <Ionicons name="musical-notes" size={56} color="#002366" />
              </View>
            </View>

            <Text className="text-gray-700 font-bold text-lg text-center mb-8">
              {detectedContent.filename}
            </Text>

            <View className="w-full max-w-sm mb-8">
              <View className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                <View
                  className="h-full bg-[#4a90e2] rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-xs">
                  {formatTime(position)}
                </Text>
                <Text className="text-gray-500 text-xs">
                  {formatTime(duration)}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Pressable
                onPress={restartAudio}
                className="w-14 h-14 rounded-full bg-gray-200 items-center justify-center mr-6"
              >
                <Feather name="rotate-ccw" size={24} color="#002366" />
              </Pressable>
              <Pressable
                onPress={togglePlayPause}
                className="w-20 h-20 rounded-full bg-[#002366] items-center justify-center shadow-lg"
              >
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={32}
                  color="white"
                />
              </Pressable>
              <View className="w-14 h-14 rounded-full bg-gray-200 items-center justify-center ml-6 opacity-50">
                <Feather name="skip-forward" size={24} color="#9CA3AF" />
              </View>
            </View>
          </View>
        );

      default:
        return (
          <View className="flex-1 items-center justify-center">
            <Feather name="file" size={64} color="#9CA3AF" />
            <Text className="text-gray-700 font-bold mt-4">
              {detectedContent.filename}
            </Text>
            <Text className="text-gray-500 text-sm mt-2">
              Type: {detectedContent.type}
            </Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={["top"]}>
      <View className="px-4 py-3 flex-row items-center bg-white border-b border-gray-200">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
            {moduleTitle || "Contenu"}
          </Text>
          <View
            className={`inline-block px-2 py-0.5 rounded-full mt-1 ${
              detectedContent.type === "pdf"
                ? "bg-red-100"
                : detectedContent.type === "epub"
                  ? "bg-green-100"
                  : detectedContent.type === "audio"
                    ? "bg-purple-100"
                    : detectedContent.type === "video"
                      ? "bg-orange-100"
                      : "bg-blue-100"
            }`}
          >
            <Text className="text-xs font-medium uppercase">
              {detectedContent.type}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-1">{renderContent()}</View>
    </SafeAreaView>
  );
}
