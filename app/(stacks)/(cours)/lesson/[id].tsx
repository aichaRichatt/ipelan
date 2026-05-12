import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useSelector } from "react-redux";
import { getCourseContents } from "../../../../services/api/courseService";
import { getMoodleLesson, getMoodleLessonPages } from "../../../../services/contentLoader";
import { RootState } from "../../../../services/redux/store";
import { mapModuleToContentType } from "../../../../utils/contentMapper";

const ADMIN_TOKEN = process.env.EXPO_PUBLIC_MOODLE_ADMIN_TOKEN;
const MOODLE_URL = process.env.EXPO_PUBLIC_MOODLE_API_URL || "https://moodle.richatt.com";

const IS_DEV = process.env.NODE_ENV === "development";

interface ModuleContent {
  filename: string;
  fileurl: string;
  type: string;
  mimetype?: string;
}

interface MoodleSection {
  id: number;
  name: string;
  summary: string;
  modules: MoodleModule[];
}

interface MoodleModule {
  id: number;
  name: string;
  modname: string;
  description?: string;
  contents?: ModuleContent[];
  url?: string;
  instance?: number;
}

const styles = StyleSheet.create({
  // Layout
  container: { flex: 1, backgroundColor: '#FAF9F6' },
  // Loading
  loadingContainer: { flex: 1, backgroundColor: '#FAF9F6', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#4B5563', marginTop: 16 },
  loadingSubText: { color: '#9CA3AF', fontSize: 12, marginTop: 8 },
  // Redirect
  redirectContainer: { flex: 1, backgroundColor: '#FAF9F6', alignItems: 'center', justifyContent: 'center' },
  redirectText: { color: '#4B5563', marginTop: 16 },
  // Error
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  errorText: { color: '#6B7280', marginTop: 16, textAlign: 'center' },
  errorSubText: { color: '#9CA3AF', fontSize: 14, marginTop: 8, textAlign: 'center' },
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FAF9F6' },
  backButton: { marginLeft: -8, marginRight: 16, padding: 8 },
  headerContent: { flex: 1 },
  headerTitle: { color: '#111827', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#6B7280', fontSize: 12 },
  // Progress bar
  progressBarWrapper: { paddingHorizontal: 20, marginBottom: 8 },
  progressBarTrack: { backgroundColor: '#E5E7EB', borderRadius: 9999, height: 4, overflow: 'hidden' },
  progressBarFill: { backgroundColor: '#F59E0B', borderRadius: 9999, height: '100%' },
  // WebView
  webviewContainer: { flex: 1, backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1 },
  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  continueButtonEnabled: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: '#002366' },
  continueButtonDisabled: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', backgroundColor: '#D1D5DB' },
  continueButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  scrollHint: { color: '#9CA3AF', fontSize: 12, marginTop: 8, textAlign: 'center' },
});

export default function LessonScreen() {
  const router = useRouter();
  const { id, courseId: courseIdParam } = useLocalSearchParams<{ id: string; courseId?: string }>();
  const moduleId = parseInt(id || "0", 10);
  const courseId = parseInt(courseIdParam || "0", 10);

  const token = useSelector((state: RootState) => state.auth.token);

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [lessonTitle, setLessonTitle] = useState<string>('Leçon');
  const [error, setError] = useState<string | null>(null);
  const targetModuleRef = useRef<MoodleModule | null>(null);

  const getAuthToken = () => {
    return token && token.length > 10 ? token : (ADMIN_TOKEN || '');
  };

  const cleanAndAuthUrl = (url: string): string => {
    const authToken = getAuthToken();
    if (!url) return url;

    let cleaned = url;
    cleaned = cleaned.replace(/[?&]forceddownload=1/gi, '');
    cleaned = cleaned.replace(/[?&]download=1/gi, '');

    while (cleaned.endsWith('?') || cleaned.endsWith('&')) {
      cleaned = cleaned.slice(0, -1);
    }

    if (cleaned.includes('token=') || cleaned.includes('wstoken=')) return cleaned;
    if (!authToken) return cleaned;

    const separator = cleaned.includes('?') ? '&' : '?';
    if (cleaned.includes('pluginfile.php')) return `${cleaned}${separator}token=${authToken}`;
    return `${cleaned}${separator}wstoken=${authToken}`;
  };

  const fetchWithAuth = async (url: string): Promise<string | null> => {
    const authToken = getAuthToken();
    if (!authToken) {
      if (IS_DEV) console.warn("[Lesson] No auth token available");
      return null;
    }
    try {
      const finalUrl = cleanAndAuthUrl(url);
      if (IS_DEV) console.log("[Lesson] Fetching with auth:", finalUrl);
      const response = await fetch(finalUrl, {
        headers: { 'Authorization': `Bearer ${authToken}`, 'Accept': 'text/html, application/xhtml+xml, */*' },
      });
      if (response.ok) {
        const text = await response.text();
        if (text.includes('"error"') && text.length < 500) return null;
        if (!text.includes('<') && text.length < 200) return null;
        return text;
      }
      if (IS_DEV) console.warn("[Lesson] Fetch failed:", response.status);
      return null;
    } catch (err) {
      if (IS_DEV) console.warn("[Lesson] Fetch error:", err);
      return null;
    }
  };

  const processHtmlContent = (html: string, baseUrl: string = ''): string => {
    let processedHtml = html;

    processedHtml = processedHtml.replace(
      /<a\s+([^>]*?)href=["']([^"']*)["']([^>]*)>/gi,
      (_, attrsBefore, href, attrsAfter) => {
        if (href.startsWith('http') && href.includes('moodle')) {
          const authHref = cleanAndAuthUrl(href);
          return `<a ${attrsBefore}href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'openUrl', url:'${authHref}'}))"${attrsAfter}>`;
        }
        if (href.startsWith('/') || !href.includes('://')) {
          const fullUrl = href.startsWith('/') ? `${MOODLE_URL}${href}` : `${baseUrl}/${href}`;
          const authHref = cleanAndAuthUrl(fullUrl);
          return `<a ${attrsBefore}href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'openUrl', url:'${authHref}'}))"${attrsAfter}>`;
        }
        return `<a ${attrsBefore}href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'openUrl', url:'${href}'}))"${attrsAfter}>`;
      }
    );

    processedHtml = processedHtml.replace(
      /<(img|script|link|source)\s+([^>]*?)src=["']([^"']*)["']([^>]*)>/gi,
      (_, tag, attrsBefore, src, attrsAfter) => {
        let authSrc = src;
        if (src.startsWith('/')) authSrc = `${MOODLE_URL}${src}`;
        else if (!src.includes('://') && baseUrl) authSrc = `${baseUrl}/${src}`;
        authSrc = cleanAndAuthUrl(authSrc);
        return `<${tag} ${attrsBefore}src="${authSrc}"${attrsAfter}>`;
      }
    );

    processedHtml = processedHtml.replace(
      /background:\s*url\(["']?([^"')]*)["']?\)/gi,
      (_, url) => {
        let authUrl = url;
        if (url.startsWith('/')) authUrl = `${MOODLE_URL}${url}`;
        return `background:url(${cleanAndAuthUrl(authUrl)})`;
      }
    );

    return processedHtml;
  };

  const loadCourseContent = useCallback(async () => {
    if (!token || !courseId) {
      setError("Paramètres manquants");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (IS_DEV) console.log("[Lesson] Loading module:", moduleId, "from course:", courseId);

      const contents = await getCourseContents(token, courseId);
      if (!contents || contents.length === 0) {
        setError("Aucune section trouvée dans ce cours");
        setIsLoading(false);
        return;
      }

      let targetModule: MoodleModule | null = null;
      let foundInSection = "";

      for (const section of contents) {
        if (section.modules && Array.isArray(section.modules)) {
          for (const mod of section.modules) {
            if (mod.id === moduleId) {
              targetModule = mod;
              foundInSection = section.name;
              break;
            }
          }
        }
        if (targetModule) break;
      }

      if (!targetModule && moduleId > 0) {
        for (const section of contents) {
          if (section.modules?.length > 0) {
            targetModule = section.modules[0];
            foundInSection = section.name;
            break;
          }
        }
      }

      if (!targetModule) {
        setError("Module non trouvé");
        setIsLoading(false);
        return;
      }

      targetModuleRef.current = targetModule;
      setLessonTitle(targetModule.name || "Leçon");

      if (IS_DEV) {
        console.log("[Lesson] Found module:", targetModule.name, "- Type:", targetModule.modname);
        console.log("[Lesson] Contents:", targetModule.contents?.length || 0, "| Section:", foundInSection);
      }

      if (targetModule.modname === 'lesson' && targetModule.instance) {
        if (IS_DEV) console.log("[Lesson] Loading lesson pages for instance:", targetModule.instance);
        const lessonData = await getMoodleLesson(token, targetModule.instance);
        if (IS_DEV && lessonData) console.log("[Lesson] Lesson loaded:", lessonData.name || 'Unnamed');

        const lessonPages = await getMoodleLessonPages(token, targetModule.instance);
        if (IS_DEV) console.log("[Lesson] Pages:", lessonPages.length);

        if (lessonPages.length > 0 && lessonPages[0].contents) {
          setHtmlContent(wrapWithStyles(lessonPages[0].contents, 1, lessonPages.length));
          setIsLoading(false);
          return;
        }
      }

      const mapped = mapModuleToContentType({
        id: targetModule.id,
        name: targetModule.name,
        modname: targetModule.modname,
        modplural: '',
        instance: targetModule.instance || 0,
        description: targetModule.description,
        contents: targetModule.contents || [],
        visible: 1,
      });

      if (IS_DEV) console.log("[Lesson] Mapped type:", mapped.type);

      if (mapped.htmlContent && mapped.htmlContent.startsWith('http')) {
        const html = await fetchWithAuth(mapped.htmlContent);
        if (html && !html.includes('"error"')) {
          const baseUrl = mapped.htmlContent.substring(0, mapped.htmlContent.lastIndexOf('/'));
          setHtmlContent(wrapWithStyles(processHtmlContent(html, baseUrl), 1, 1));
          setIsLoading(false);
          return;
        }
      }

      if (targetModule.description && targetModule.description.includes('<')) {
        setHtmlContent(wrapWithStyles(processHtmlContent(targetModule.description, MOODLE_URL), 1, 1));
        setIsLoading(false);
        return;
      }

      if (targetModule.contents && targetModule.contents.length > 0) {
        for (const content of targetModule.contents) {
          if (!content.fileurl) continue;
          const filename = (content.filename || '').toLowerCase();
          const mimetype = (content.mimetype || content.type || '').toLowerCase();

          if (filename.endsWith('.pdf') || mimetype.includes('pdf')) {
            setError("PDF_DETECTED:" + content.fileurl); setIsLoading(false); return;
          }
          if (filename.endsWith('.epub') || filename.endsWith('.epub+zip')) {
            setError("EPUB_DETECTED:" + content.fileurl); setIsLoading(false); return;
          }
          if (filename.match(/\.(mp3|wav|ogg|m4a)$/) || mimetype.includes('audio')) {
            setError("AUDIO_DETECTED:" + content.fileurl); setIsLoading(false); return;
          }
          if (filename.match(/\.(mp4|webm|m4v)$/) || mimetype.includes('video')) {
            setError("VIDEO_DETECTED:" + content.fileurl); setIsLoading(false); return;
          }
          if (filename.match(/\.(html|htm|xhtml)$/) || mimetype.includes('html')) {
            const html = await fetchWithAuth(content.fileurl);
            if (html && !html.includes('"error"')) {
              const baseUrl = content.fileurl.substring(0, content.fileurl.lastIndexOf('/'));
              setHtmlContent(wrapWithStyles(processHtmlContent(html, baseUrl), 1, 1));
              setIsLoading(false);
              return;
            }
          }
          if (filename.match(/\.(jpg|jpeg|png|gif|webp|svg)$/) || mimetype.includes('image')) {
            const authUrl = cleanAndAuthUrl(content.fileurl);
            setHtmlContent(wrapWithStyles(`<div class="image-container"><img src="${authUrl}" alt="Image" /></div>`, 1, 1));
            setIsLoading(false);
            return;
          }
          if (filename.endsWith('.zip') || filename.endsWith('.scorm')) {
            setError("CONTENT_URL:" + content.fileurl); setIsLoading(false); return;
          }
          if (content.fileurl.includes('pluginfile.php') || content.fileurl.includes('draftfile.php')) {
            setError("CONTENT_URL:" + content.fileurl); setIsLoading(false); return;
          }
        }
      }

      if (targetModule.url) {
        setError("CONTENT_URL:" + targetModule.url);
        setIsLoading(false);
        return;
      }

      setError("Contenu non disponible pour ce module");
      setIsLoading(false);
    } catch (err: any) {
      if (IS_DEV) console.error('[Lesson] Error:', err);
      setError(err.message || "Erreur lors du chargement");
      setIsLoading(false);
    }
  }, [token, courseId, moduleId]);

  useEffect(() => { loadCourseContent(); }, [loadCourseContent]);

  const wrapWithStyles = (content: string, chapterNum: number = 1, totalChapters: number = 1): string => {
    const css = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px; line-height: 1.6; color: #1F2937;
          background-color: #FAF9F6; padding: 16px; padding-bottom: 140px;
        }
        img { max-width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 8px; }
        audio { width: 100%; margin: 12px 0; }
        h1, h2, h3 { color: #002366; margin: 16px 0 12px 0; }
        p { margin-bottom: 12px; text-align: justify; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        th { background: #f3f4f6; }
        .image-container { margin: 16px 0; text-align: center; }
        .image-grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 16px 0; }
        .image-grid img { width: 45%; }
        .vocab-card { background: #f8fafc; border-radius: 12px; padding: 16px; margin: 12px 0; border-left: 4px solid #4a90e2; }
        .pulaar-word { font-size: 1.4em; font-weight: bold; color: #002366; }
        .translation { color: #64748b; margin-top: 4px; }
        .dialogue { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 0 12px 12px 0; margin: 12px 0; }
        .block-head { background: linear-gradient(135deg, #002366, #4a90e2); color: white; padding: 16px; border-radius: 12px 12px 0 0; margin: 16px 0; }
        .accent { color: #F59E0B; }
        .centered { text-align: center; }
      </style>
    `;

    const script = `
      <script>
        window.addEventListener('scroll', () => {
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrolled = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
          if (scrolled >= 90) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scrollProgress', progress: scrolled }));
          }
        });
        document.addEventListener('click', (e) => {
          const link = e.target.closest('a');
          if (link && link.href) {
            e.preventDefault();
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'linkClick', url: link.href }));
          }
        });
        document.addEventListener('DOMContentLoaded', () => {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pageReady' }));
        });
      </script>
    `;

    if (content.includes('<head>')) {
      return content.replace('<head>', '<head>' + css + script);
    }
    return `<!DOCTYPE html><html><head>${css}${script}</head><body>${content}</body></html>`;
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scrollProgress' && data.progress >= 90) {
        setHasScrolledToBottom(true);
      } else if (data.type === 'pageReady') {
        setIsLoading(false);
      } else if (data.type === 'linkClick' || data.type === 'openUrl') {
        Alert.alert("Contenu externe", "Ce lien ne peut pas être ouvert dans l'application.", [{ text: "OK" }]);
      }
    } catch {
      // ignore parse errors
    }
  };

  // Redirect to unified viewer for non-HTML content types
  useEffect(() => {
    if (!error) return;
    const isRedirect = /^(PDF_DETECTED:|EPUB_DETECTED:|AUDIO_DETECTED:|VIDEO_DETECTED:|CONTENT_URL:)/.test(error);
    if (!isRedirect) return;

    const fileUrl = error.replace(/^(PDF_DETECTED:|EPUB_DETECTED:|AUDIO_DETECTED:|VIDEO_DETECTED:|CONTENT_URL:)/, "");
    const contentType = error.match(/^([A-Z_]+):/)?.[1] || 'html';
    const moduleInstance = targetModuleRef.current?.instance;

    router.replace(`/(stacks)/(cours)/content/unified-viewer?fileUrl=${encodeURIComponent(fileUrl)}&contentType=${contentType}&moduleTitle=${encodeURIComponent(lessonTitle)}&moduleId=${moduleId}&courseId=${courseId}&lessonInstance=${moduleInstance || ''}` as any);
  }, [error]);

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#002366" />
        <Text style={styles.loadingText}>Chargement de la leçon...</Text>
        <Text style={styles.loadingSubText}>Récupération du contenu depuis Moodle</Text>
      </SafeAreaView>
    );
  }

  // ─── Redirect state ──────────────────────────────────────────────────────────
  if (error && /^(PDF_DETECTED:|EPUB_DETECTED:|AUDIO_DETECTED:|VIDEO_DETECTED:|CONTENT_URL:)/.test(error)) {
    return (
      <SafeAreaView style={styles.redirectContainer}>
        <ActivityIndicator size="large" color="#002366" />
        <Text style={styles.redirectText}>Redirection...</Text>
      </SafeAreaView>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"] as any}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{lessonTitle}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#D1D5DB" />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubText}>Ce module n&apos;a pas de contenu configuré dans Moodle</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main view ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"] as any}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>{lessonTitle}</Text>
          <Text style={styles.headerSubtitle}>Cours IPELAN</Text>
        </View>
      </View>

      <View style={styles.progressBarWrapper}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: hasScrolledToBottom ? '100%' : '30%' }]} />
        </View>
      </View>

      <View style={styles.webviewContainer}>
        <WebView
          source={{ html: htmlContent }}
          style={styles.webview}
          onMessage={handleMessage}
          scrollEnabled={true}
          bounces={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          mixedContentMode="compatibility"
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.back()}
          disabled={!hasScrolledToBottom}
          style={hasScrolledToBottom ? styles.continueButtonEnabled : styles.continueButtonDisabled}
        >
          <Text style={styles.continueButtonText}>Continuer vers les activités</Text>
        </Pressable>
        {!hasScrolledToBottom && (
          <Text style={styles.scrollHint}>Déroule la page pour continuer</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
