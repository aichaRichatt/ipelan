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
  absolute_bottom_0_left_0_right_0_bg_whit: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    position: 'absolute'
  },
  flex_1: {
    flex: 1
  },
  flex_1_bg___FAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flex_1_bg___FAF9F6__items_center_justify: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flex: 1,
    justifyContent: 'center'
  },
  flex_1_bg_white_mx_4_rounded_xl_overflow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 16,
    overflow: 'hidden'
  },
  flex_1_items_center_justify_center_px_5: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  h_1_bg_gray_200_rounded_full_overflow_hi: {
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    height: 4,
    overflow: 'hidden'
  },
  h_full_bg___F59E0B__rounded_full_transit: {
    backgroundColor: '#F59E0B',
    borderRadius: 9999,
    height: '100%'
  },
  mr_4_p_2__ml_2: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  mt_2_text_gray_400_text_xs: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8
  },
  mt_4_text_gray_600: {
    color: '#4B5563',
    marginTop: 16
  },
  px_5_mb_2: {
    marginBottom: 8,
    paddingHorizontal: 20
  },
  px_5_py_4_flex_row_items_center_bg___FAF: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_1: {
    marginLeft: -8,
    marginRight: 16,
    padding: 8
  },
  style_2: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_3: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_4: {
    color: '#4B5563',
    marginTop: 16
  },
  style_5: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    flex: 1,
    justifyContent: 'center'
  },
  text_center_text_gray_400_text_xs_mt_2: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center'
  },
  text_gray_400_text_sm_mt_2_text_center: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  text_gray_500_mt_4_text_center: {
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center'
  },
  text_gray_500_text_xs: {
    color: '#6B7280',
    fontSize: 12
  },
  text_lg_font_bold_text_gray_900: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700'
  },
  text_lg_font_bold_text_gray_900_flex_1: {
    color: '#111827',
    flex: 1,
    fontSize: 18,
    fontWeight: '700'
  },
  text_white_font_bold_text_lg: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
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
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'text/html, application/xhtml+xml, */*',
        },
      });

      if (response.ok) {
        const text = await response.text();
        
        if (text.includes('"error"') && text.length < 500) {
          if (IS_DEV) console.warn("[Lesson] Response contains error:", text);
          return null;
        }
        
        if (!text.includes('<') && text.length < 200) {
          if (IS_DEV) console.warn("[Lesson] Response doesn't look like HTML:", text);
          return null;
        }
        
        return text;
      } else {
        if (IS_DEV) console.warn("[Lesson] Fetch failed:", response.status, response.statusText);
        return null;
      }
    } catch (err) {
      if (IS_DEV) console.warn("[Lesson] Fetch error:", err);
      return null;
    }
  };

  const processHtmlContent = (html: string, baseUrl: string = ''): string => {
    let processedHtml = html;
    
    processedHtml = processedHtml.replace(
      /<a\s+([^>]*?)href=["']([^"']*)["']([^>]*)>/gi,
      (match, attrsBefore, href, attrsAfter) => {
        if (href.startsWith('http') && href.includes('moodle')) {
          const authHref = cleanAndAuthUrl(href);
          return `<a ${attrsBefore}href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'openUrl', url:'${authHref}'}))"${attrsAfter}>`;
        }
        if (href.startsWith('/') || !href.includes('://')) {
          const fullUrl = href.startsWith('/') 
            ? `${MOODLE_URL}${href}` 
            : `${baseUrl}/${href}`;
          const authHref = cleanAndAuthUrl(fullUrl);
          return `<a ${attrsBefore}href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'openUrl', url:'${authHref}'}))"${attrsAfter}>`;
        }
        return `<a ${attrsBefore}href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'openUrl', url:'${href}'}))"${attrsAfter}>`;
      }
    );
    
    processedHtml = processedHtml.replace(
      /<(img|script|link|source)\s+([^>]*?)src=["']([^"']*)["']([^>]*)>/gi,
      (match, tag, attrsBefore, src, attrsAfter) => {
        let authSrc = src;
        
        if (src.startsWith('/')) {
          authSrc = `${MOODLE_URL}${src}`;
        } else if (!src.includes('://') && baseUrl) {
          authSrc = `${baseUrl}/${src}`;
        }
        
        authSrc = cleanAndAuthUrl(authSrc);
        
        return `<${tag} ${attrsBefore}src="${authSrc}"${attrsAfter}>`;
      }
    );
    
    processedHtml = processedHtml.replace(
      /background:\s*url\(["']?([^"')]*)["']?\)/gi,
      (match, url) => {
        let authUrl = url;
        if (url.startsWith('/')) {
          authUrl = `${MOODLE_URL}${url}`;
        }
        authUrl = cleanAndAuthUrl(authUrl);
        return `background:url(${authUrl})`;
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
      let foundInSection: string = "";

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
          if (section.modules && Array.isArray(section.modules)) {
            if (section.modules.length > 0) {
              targetModule = section.modules[0];
              foundInSection = section.name;
              break;
            }
          }
        }
      }

      if (!targetModule) {
        setError("Module non trouvé");
        setIsLoading(false);
        return;
      }

      targetModuleRef.current = targetModule;
      
      const lessonInstanceId = targetModule.instance;
      if (IS_DEV) console.log("[Lesson] Module instance (lesson ID):", lessonInstanceId);

      if (IS_DEV) {
        console.log("[Lesson] Found module:", targetModule.name, "- Type:", targetModule.modname);
        console.log("[Lesson] Contents count:", targetModule.contents?.length || 0);
        console.log("[Lesson] Section:", foundInSection);
      }

      setLessonTitle(targetModule.name || "Leçon");

      if (targetModule.modname === 'lesson' && lessonInstanceId) {
        if (IS_DEV) console.log("[Lesson] Loading lesson content via API for instance:", lessonInstanceId);
        
        const lessonData = await getMoodleLesson(token, lessonInstanceId);
        if (lessonData) {
          if (IS_DEV) console.log("[Lesson] Lesson data loaded:", lessonData.name || 'Unnamed');
        }
        
        const lessonPages = await getMoodleLessonPages(token, lessonInstanceId);
        if (IS_DEV) console.log("[Lesson] Lesson pages:", lessonPages.length);
        
        if (lessonPages.length > 0) {
          const firstPage = lessonPages[0];
          if (firstPage.contents) {
            const styledHtml = wrapWithStyles(firstPage.contents, 1, lessonPages.length);
            setHtmlContent(styledHtml);
            setIsLoading(false);
            return;
          }
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
      if (IS_DEV) console.log("[Lesson] Module contents:", JSON.stringify(mapped.module.contents, null, 2));

      if (mapped.htmlContent && mapped.htmlContent.startsWith('http')) {
        if (IS_DEV) console.log("[Lesson] Fetching HTML from URL:", mapped.htmlContent);
        const html = await fetchWithAuth(mapped.htmlContent);
        if (html && !html.includes('"error"')) {
          if (IS_DEV) console.log("[Lesson] HTML fetched successfully, length:", html.length);
          const baseUrl = mapped.htmlContent.substring(0, mapped.htmlContent.lastIndexOf('/'));
          const processedHtml = processHtmlContent(html, baseUrl);
          const styledHtml = wrapWithStyles(processedHtml, 1, 1);
          setHtmlContent(styledHtml);
          setIsLoading(false);
          return;
        } else if (html) {
          if (IS_DEV) console.warn("[Lesson] HTML fetch returned error response");
        } else {
          if (IS_DEV) console.warn("[Lesson] HTML fetch returned null");
        }
      }

      if (targetModule.description && targetModule.description.includes('<')) {
        if (IS_DEV) console.log("[Lesson] Using description as HTML content");
        const processedHtml = processHtmlContent(targetModule.description, MOODLE_URL);
        const styledHtml = wrapWithStyles(processedHtml, 1, 1);
        setHtmlContent(styledHtml);
        setIsLoading(false);
        return;
      }

      if (targetModule.contents && targetModule.contents.length > 0) {
        if (IS_DEV) console.log("[Lesson] Processing", targetModule.contents.length, "contents");
        for (const content of targetModule.contents) {
          if (IS_DEV) console.log("[Lesson] Content file:", content.filename, "| Type:", content.type, "| MimeType:", content.mimetype, "| URL:", content.fileurl?.substring(0, 100));
          
          if (content.fileurl) {
            const filename = (content.filename || '').toLowerCase();
            const mimetype = (content.mimetype || content.type || '').toLowerCase();
            
            if (filename.endsWith('.pdf') || mimetype.includes('pdf')) {
              if (IS_DEV) console.log("[Lesson] Detected PDF, redirecting to PDF viewer");
              setError("PDF_DETECTED:" + content.fileurl);
              setIsLoading(false);
              return;
            }
            
            if (filename.endsWith('.epub') || filename.endsWith('.epub+zip')) {
              if (IS_DEV) console.log("[Lesson] Detected EPUB, redirecting to EPUB reader");
              setError("EPUB_DETECTED:" + content.fileurl);
              setIsLoading(false);
              return;
            }
            
            if (filename.match(/\.(mp3|wav|ogg|m4a|mp4|webm|m4v)$/) || mimetype.match(/audio|video/)) {
              if (filename.match(/\.(mp3|wav|ogg|m4a)$/) || mimetype.includes('audio')) {
                if (IS_DEV) console.log("[Lesson] Detected audio, redirecting to audio player");
                setError("AUDIO_DETECTED:" + content.fileurl);
                setIsLoading(false);
                return;
              }
              if (IS_DEV) console.log("[Lesson] Detected video, redirecting to unified viewer");
              setError("VIDEO_DETECTED:" + content.fileurl);
              setIsLoading(false);
              return;
            }
            
            if (filename.endsWith('.html') || filename.endsWith('.htm') || filename.endsWith('.xhtml') || mimetype.includes('html')) {
              if (IS_DEV) console.log("[Lesson] Fetching HTML file:", content.fileurl);
              const html = await fetchWithAuth(content.fileurl);
              if (html && !html.includes('"error"')) {
                if (IS_DEV) console.log("[Lesson] HTML fetched successfully");
                const baseUrl = content.fileurl.substring(0, content.fileurl.lastIndexOf('/'));
                const processedHtml = processHtmlContent(html, baseUrl);
                const styledHtml = wrapWithStyles(processedHtml, 1, 1);
                setHtmlContent(styledHtml);
                setIsLoading(false);
                return;
              } else if (html) {
                if (IS_DEV) console.warn("[Lesson] HTML fetch returned error");
              } else {
                if (IS_DEV) console.warn("[Lesson] HTML fetch returned null (possible auth issue)");
              }
            }

            if (filename.match(/\.(jpg|jpeg|png|gif|webp|svg)$/) || mimetype.includes('image')) {
              const authUrl = cleanAndAuthUrl(content.fileurl);
              const imgHtml = wrapWithStyles(
                `<div class="image-container"><img src="${authUrl}" alt="Image" /></div>`,
                1, 1
              );
              setHtmlContent(imgHtml);
              setIsLoading(false);
              return;
            }
            
            if (filename.endsWith('.zip') || filename.endsWith('.scorm')) {
              if (IS_DEV) console.log("[Lesson] Detected ZIP/SCORM, redirecting to unified viewer");
              setError("CONTENT_URL:" + content.fileurl);
              setIsLoading(false);
              return;
            }
            
            if (content.fileurl && (content.fileurl.includes('pluginfile.php') || content.fileurl.includes('draftfile.php'))) {
              if (IS_DEV) console.log("[Lesson] Unknown Moodle file type, redirecting to unified viewer");
              setError("CONTENT_URL:" + content.fileurl);
              setIsLoading(false);
              return;
            }
          }
        }
      }

      if (targetModule.url) {
        if (IS_DEV) console.log("[Lesson] Module has URL, redirecting to unified viewer");
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

  useEffect(() => {
    loadCourseContent();
  }, [loadCourseContent]);

  const wrapWithStyles = (content: string, chapterNum: number = 1, totalChapters: number = 1): string => {
    const styles = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px;
          line-height: 1.6;
          color: #1F2937;
          background-color: #FAF9F6;
          padding: 16px;
          padding-bottom: 140px;
        }
        .chapter-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-top: 1px solid #e5e7eb;
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 100;
        }
        .chapter-nav button {
          background: #002366;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
        }
        .chapter-nav button:disabled {
          background: #d1d5db;
        }
        .chapter-nav .chapter-info {
          font-size: 14px;
          color: #6b7280;
        }
        img { max-width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 8px; }
        audio { width: 100%; margin: 12px 0; }
        h1, h2, h3 { color: #002366; margin: 16px 0 12px 0; }
        p { margin-bottom: 12px; text-align: justify; }
        .chapter-wrapper { margin-bottom: 40px; }
        .fixed-page { min-height: 100vh; padding: 20px; }
        .logo { max-width: 150px; margin: 20px auto; }
        .bordered-box { border: 2px solid #4a90e2; border-radius: 12px; padding: 16px; margin: 16px 0; }
        .image-center { text-align: center; margin: 16px 0; }
        .image-container { margin: 16px 0; text-align: center; }
        .image-grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 16px 0; }
        .image-grid img { width: 45%; }
        .dialogue-section { display: flex; flex-direction: column; gap: 16px; }
        .block-head { background: linear-gradient(135deg, #002366, #4a90e2); color: white; padding: 16px; border-radius: 12px 12px 0 0; margin: 16px 0; }
        .main-title { font-size: 1.4em; margin: 0; }
        .accent { color: #F59E0B; }
        .dialogue { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 0 12px 12px 0; margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
        th { background: #f3f4f6; }
        .bottom-text { text-align: center; color: #64748b; font-size: 0.9em; margin-top: 40px; }
        .small-text { font-size: 0.9em; }
        .centered { text-align: center; }
        .left-label { font-size: 0.9em; margin-bottom: 4px; }
        .external-content { padding: 20px; text-align: center; }
        .external-content a { color: #002366; font-size: 18px; }
        .vocab-card { background: #f8fafc; border-radius: 12px; padding: 16px; margin: 12px 0; border-left: 4px solid #4a90e2; }
        .pulaar-word { font-size: 1.4em; font-weight: bold; color: #002366; }
        .translation { color: #64748b; margin-top: 4px; }
      </style>
    `;

    const navigationScript = `
      <script>
        function playAudio(wordId) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'playAudio',
            wordId: wordId
          }));
        }
        document.addEventListener('DOMContentLoaded', () => {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'pageReady'
          }));
        });
        window.addEventListener('scroll', () => {
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrolled = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
          if (scrolled >= 90) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'scrollProgress',
              progress: scrolled
            }));
          }
        });
        document.addEventListener('click', (e) => {
          const link = e.target.closest('a');
          if (link && link.href) {
            e.preventDefault();
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'linkClick',
              url: link.href
            }));
          }
        });
      </script>
    `;

    if (content.includes('<head>')) {
      return content
        .replace('<head>', '<head>' + styles + navigationScript)
        .replace('</body>', '</body>');
    } else {
      return `<!DOCTYPE html><html><head>${styles}${navigationScript}</head><body>${content}</body></html>`;
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'playAudio') {
        Alert.alert("Audio", `Lecture: ${data.wordId}`);
      } else if (data.type === 'scrollProgress') {
        if (data.progress >= 90) {
          setHasScrolledToBottom(true);
        }
      } else if (data.type === 'pageReady') {
        setIsLoading(false);
      } else if (data.type === 'linkClick' || data.type === 'openUrl') {
        Alert.alert(
          "Contenu externe",
          "Ce lien ne peut pas être ouvert dans l'application.",
          [{ text: "OK" }]
        );
      }
    } catch {
      // Ignore parse errors
    }
  };

  // Handle all content type redirects to unified viewer
  useEffect(() => {
    if (!error) return;
    
    const fileUrl = error.replace(/^(PDF_DETECTED:|EPUB_DETECTED:|AUDIO_DETECTED:|VIDEO_DETECTED:|CONTENT_URL:)/, "");
    const contentType = error.match(/^(PDF_DETECTED:|EPUB_DETECTED:|AUDIO_DETECTED:|VIDEO_DETECTED:|CONTENT_URL:)/)?.[0]?.replace(/:$/, '') || 'html';
    
    if (IS_DEV) console.log("[Lesson] Redirecting to unified viewer:", contentType, "| URL:", fileUrl.substring(0, 100));
    
    const targetModuleInstance = targetModuleRef.current?.instance;
    
    router.replace(`/(stacks)/(cours)/content/unified-viewer?fileUrl=${encodeURIComponent(fileUrl)}&contentType=${contentType}&moduleTitle=${encodeURIComponent(lessonTitle)}&moduleId=${moduleId}&courseId=${courseId}&lessonInstance=${targetModuleInstance || ''}` as any);
  }, [error]);

  const handleContinue = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.style_5}>
        <ActivityIndicator size="large" color="#002366" />
        <Text style={styles.style_4}>Chargement de la leçon...</Text>
        <Text style={styles.mt_2_text_gray_400_text_xs}>Récupération du contenu depuis Moodle</Text>
      </SafeAreaView>
    );
  }

  if (error && (error.startsWith('PDF_DETECTED:') || error.startsWith('EPUB_DETECTED:') || error.startsWith('AUDIO_DETECTED:') || error.startsWith('VIDEO_DETECTED:') || error.startsWith('CONTENT_URL:'))) {
    return (
      <SafeAreaView style={styles.flex_1_bg___FAF9F6__items_center_justify}>
        <ActivityIndicator size="large" color="#002366" />
        <Text style={styles.mt_4_text_gray_600}>Redirection...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.style_3} edges={["top"]}>
        <View style={styles.style_2}>
          <Pressable onPress={() => router.back()} style={styles.style_1}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.text_lg_font_bold_text_gray_900_flex_1} numberOfLines={1}>
            {lessonTitle}
          </Text>
        </View>
        <View style={styles.flex_1_items_center_justify_center_px_5}>
          <Feather name="alert-circle" size={48} color="#D1D5DB" />
          <Text style={styles.text_gray_500_mt_4_text_center}>{error}</Text>
          <Text style={styles.text_gray_400_text_sm_mt_2_text_center}>
            Ce module n&apos;as pas de contenu configuré dans Moodle
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex_1_bg___FAF9F6} edges={["top"]}>
      <View style={styles.px_5_py_4_flex_row_items_center_bg___FAF}>
        <Pressable onPress={() => router.back()} style={styles.mr_4_p_2__ml_2}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View style={styles.flex_1}>
          <Text style={styles.text_lg_font_bold_text_gray_900} numberOfLines={1}>
            {lessonTitle}
          </Text>
          <Text style={styles.text_gray_500_text_xs}>Cours IPELAN</Text>
        </View>
      </View>

      <View style={styles.px_5_mb_2}>
        <View style={styles.h_1_bg_gray_200_rounded_full_overflow_hi}>
          <View
            style={[styles.h_full_bg___F59E0B__rounded_full_transit,{ width: hasScrolledToBottom ? "100%" : "30%" }]}
           />
        </View>
      </View>

      <View style={styles.flex_1_bg_white_mx_4_rounded_xl_overflow}>
        <WebView
          source={{ html: htmlContent }}
          style={{ flex: 1 }}
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

      <View style={styles.absolute_bottom_0_left_0_right_0_bg_whit}>
        <Pressable
          onPress={handleContinue}
          disabled={!hasScrolledToBottom}
          style={{
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            backgroundColor: hasScrolledToBottom ? '#002366' : '#D1D5DB'
          }}
        >
          <Text style={styles.text_white_font_bold_text_lg}>
            Continuer vers les activités
          </Text>
        </Pressable>
        {!hasScrolledToBottom && (
          <Text style={styles.text_center_text_gray_400_text_xs_mt_2}>
            Déroule la page pour continuer
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
