import { Feather } from "@expo/vector-icons";
import React, { useState, useEffect, useCallback } from "react";
import { Pressable, Text, View, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useSelector } from "react-redux";
import { RootState } from "../../../../services/redux/store";
import { getCourseContents, getEnrolledCoursesByTimeline } from "../../../../services/api/courseService";

interface ModuleContent {
  filename: string;
  fileurl: string;
  type: string;
}

interface CourseModule {
  id: number;
  name: string;
  contents: ModuleContent[];
}

export default function LessonScreen() {
  const router = useRouter();
  const { id, moduleName } = useLocalSearchParams<{ id: string; moduleName?: string }>();
  const lessonId = parseInt(id || "1", 10);
  const courseId = parseInt(id || "1", 10);
  
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [lessonTitle, setLessonTitle] = useState<string>('Leçon ' + lessonId);
  const [spine, setSpine] = useState<string[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [allModules, setAllModules] = useState<CourseModule[]>([]);

  const loadCourseContent = useCallback(async () => {
    if (!token) {
      const fallbackHtml = getFallbackLessonHTML();
      setHtmlContent(fallbackHtml);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log("[Lesson] Loading course content for course:", courseId);
      
      const contents = await getCourseContents(token, courseId);
      
      console.log("[Lesson] Course contents received:", contents.length, "sections");
      
      if (contents.length === 0) {
        console.log("[Lesson] No sections found, checking enrolled courses...");
        
        try {
          const enrolled = await getEnrolledCoursesByTimeline(token);
          console.log("[Lesson] Enrolled courses:", enrolled);
        } catch (e) {
          console.warn("[Lesson] Could not get enrolled courses:", e);
        }
        
        const fallbackHtml = getFallbackLessonHTML();
        setHtmlContent(fallbackHtml);
        setIsLoading(false);
        return;
      }
      
      const modules: CourseModule[] = [];
      
      for (const section of contents) {
        const sectionName = section.name || section.summary || `Section ${contents.indexOf(section) + 1}`;
        console.log("[Lesson] Section:", sectionName, "- Modules:", section.modules?.length || 0);
        
        if (section.modules && Array.isArray(section.modules)) {
          for (const mod of section.modules) {
            const moduleInfo = {
              id: mod.id,
              name: mod.name || mod.description?.substring(0, 50) || `Module ${mod.id}`,
              contents: mod.contents || [],
              modname: mod.modname,
              url: mod.url,
              description: mod.description
            };
            
            console.log("[Lesson] Module:", moduleInfo.name, "- Type:", mod.modname, "- Contents:", moduleInfo.contents.length);
            
            modules.push(moduleInfo);
          }
        }
      }
      
      setAllModules(modules);
      console.log("[Lesson] Total modules found:", modules.length);
      
      if (modules.length === 0) {
        console.log("[Lesson] No modules found, using fallback");
        const fallbackHtml = getFallbackLessonHTML();
        setHtmlContent(fallbackHtml);
        setIsLoading(false);
        return;
      }

      const currentModule = modules.find(m => m.id === lessonId) || modules[0];
      
      if (currentModule) {
        console.log("[Lesson] Current module:", currentModule.name, "- Type:", currentModule.modname);
        setLessonTitle(currentModule.name);
        
        if (currentModule.contents && currentModule.contents.length > 0) {
          for (const content of currentModule.contents) {
            if (content.fileurl && (content.filename.endsWith('.html') || content.filename.endsWith('.xhtml') || content.filename.endsWith('.htm'))) {
              console.log("[Lesson] Found HTML content:", content.filename, content.fileurl);
              
              try {
                const response = await fetch(content.fileurl);
                if (response.ok) {
                  let html = await response.text();
                  
                  html = wrapWithStyles(html, 1, 1);
                  
                  setHtmlContent(html);
                  setBaseUrl('');
                  setSpine([content.filename]);
                  setCurrentChapter(0);
                  setHasScrolledToBottom(false);
                  setIsLoading(false);
                  return;
                }
              } catch (fetchErr) {
                console.warn("[Lesson] Failed to fetch HTML:", fetchErr);
              }
            }
          }
        }
        
        if (currentModule.modname === 'page' && currentModule.description) {
          console.log("[Lesson] Module is a page, using description as content");
          const pageHtml = wrapWithStyles(currentModule.description, 1, 1);
          setHtmlContent(pageHtml);
          setIsLoading(false);
          return;
        }
      }

      const fallbackHtml = getFallbackLessonHTML();
      setHtmlContent(fallbackHtml);
      setSpine([]);
      setIsLoading(false);
      
    } catch (err) {
      console.warn('[Lesson] Failed to load course content:', err);
      const fallbackHtml = getFallbackLessonHTML();
      setHtmlContent(fallbackHtml);
      setSpine([]);
      setIsLoading(false);
    }
  }, [token, courseId, lessonId]);

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
        .image-container { margin: 16px 0; }
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

  const getFallbackLessonHTML = (): string => {
    return `
      <!DOCTYPE html>
      <html lang="pulaar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: #1F2937;
            background-color: #FAF9F6;
            padding: 16px;
            padding-bottom: 100px;
          }
          .header {
            background: linear-gradient(135deg, #002366, #4a90e2);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            text-align: center;
          }
          .header h1 { font-size: 1.5em; margin-bottom: 8px; }
          .section {
            background: white;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .section h2 { color: #002366; font-size: 1.3em; margin-bottom: 12px; }
          p { margin-bottom: 12px; text-align: justify; }
          .vocab-card {
            background: linear-gradient(135deg, #f8fafc, #f1f5f9);
            border-radius: 12px;
            padding: 16px;
            margin: 12px 0;
            border-left: 4px solid #4a90e2;
          }
          .pulaar-word { font-size: 1.4em; font-weight: bold; color: #002366; }
          .translation { color: #64748b; margin-top: 4px; }
          .audio-btn {
            background: linear-gradient(135deg, #4a90e2, #3b82f6);
            color: white;
            border: none;
            border-radius: 20px;
            padding: 8px 16px;
            font-size: 0.9em;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 Deftere Pulaar - Tolon 1</h1>
          <p>Manuel pour apprendre le Pulaar</p>
        </div>

        <div class="section">
          <h2>👋 Les Salutations</h2>
          <div class="vocab-card">
            <div class="pulaar-word">Min ka ndef?</div>
            <div class="translation">Comment allez-vous?</div>
            <button class="audio-btn" onclick="playAudio('salut1')">🔊 Écouter</button>
          </div>
          <div class="vocab-card">
            <div class="pulaar-word">Mii njaax</div>
            <div class="translation">Je vais bien</div>
          </div>
          <div class="vocab-card">
            <div class="pulaar-word">Baani</div>
            <div class="translation">Au revoir</div>
          </div>
        </div>

        <div class="section">
          <h2>🔢 Les Nombres</h2>
          <div class="vocab-card">
            <div class="pulaar-word">Go'o</div>
            <div class="translation">Un (1)</div>
          </div>
          <div class="vocab-card">
            <div class="pulaar-word">Diidi</div>
            <div class="translation">Deux (2)</div>
          </div>
          <div class="vocab-card">
            <div class="pulaar-word">Tati</div>
            <div class="translation">Trois (3)</div>
          </div>
        </div>

        <div class="section">
          <h2>👨‍👩‍👧 La Famille</h2>
          <div class="vocab-card">
            <div class="pulaar-word">Baaba</div>
            <div class="translation">Père</div>
          </div>
          <div class="vocab-card">
            <div class="pulaar-word">Yaaya</div>
            <div class="translation">Mère</div>
          </div>
          <div class="vocab-card">
            <div class="pulaar-word">Koy</div>
            <div class="translation">Frère/Sœur</div>
          </div>
        </div>
      </body>
      </html>
    `;
    
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'playAudio') {
        Alert.alert("🔊 Audio", `Lecture: ${data.wordId}`, [
          { text: "OK" }
        ]);
      } else if (data.type === 'scrollProgress') {
        if (data.progress >= 90) {
          setHasScrolledToBottom(true);
        }
      } else if (data.type === 'pageReady') {
        setIsLoading(false);
      }
    } catch (error) {
      console.warn('WebView message error:', error);
    }
  };

  const handleContinue = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6] items-center justify-center">
        <ActivityIndicator size="large" color="#002366" />
        <Text className="mt-4 text-gray-600">Chargement de la leçon...</Text>
        <Text className="mt-2 text-gray-400 text-xs">Récupération du contenu depuis Moodle</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={["top"]}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
            {lessonTitle}
          </Text>
          <Text className="text-gray-500 text-xs">Cours IPELAN</Text>
        </View>
      </View>

      <View className="px-5 mb-2">
        <View className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <View 
            className="h-full bg-[#F59E0B] rounded-full transition-all duration-300" 
            style={{ width: hasScrolledToBottom ? "100%" : "30%" }} 
          />
        </View>
      </View>

      <View className="flex-1 bg-white mx-4 rounded-xl overflow-hidden mb-24">
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

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-5 py-4">
        <Pressable
          onPress={handleContinue}
          disabled={!hasScrolledToBottom}
          className={`rounded-2xl py-4 items-center ${
            hasScrolledToBottom ? "bg-[#002366]" : "bg-gray-300"
          }`}
        >
          <Text className="text-white font-bold text-lg">
            Continuer vers les activités
          </Text>
        </Pressable>
        {!hasScrolledToBottom && (
          <Text className="text-center text-gray-400 text-xs mt-2">
            Déroule la page pour continuer
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
