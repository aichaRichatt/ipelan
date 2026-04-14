import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState, useCallback } from "react";
import { 
  View, 
  Text, 
  Pressable, 
  ActivityIndicator, 
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "../../../../services/redux/store";
import { useEpubReader } from "../../../../hooks/useEpubReader";

export default function EpubReaderScreen() {
  const router = useRouter();
  const { epubUrl, title } = useLocalSearchParams<{ epubUrl?: string; title?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [showToc, setShowToc] = useState(false);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [currentAudioIndex] = useState(0);

  const {
    isLoading,
    error,
    title: epubTitle,
    chapters,
    currentChapter,
    currentHtml,
    audioFiles,
    progress,
    totalChapters,
    goToChapter,
    nextChapter,
    previousChapter,
    hasNextChapter,
    hasPreviousChapter,
    refetch,
  } = useEpubReader(epubUrl || null, token || '');

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scrollProgress' && data.progress >= 85) {
        setHasScrolledToBottom(true);
      }
    } catch {
    }
  }, []);

  const handleChapterSelect = (index: number) => {
    goToChapter(index);
    setShowToc(false);
  };

  const htmlWithStyles = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 18px;
          line-height: 1.8;
          color: #1F2937;
          background-color: #FAF9F6;
          padding: 20px;
          padding-bottom: 120px;
        }
        h1, h2, h3, h4, h5, h6 { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #002366;
          margin: 24px 0 16px 0;
          line-height: 1.3;
        }
        h1 { font-size: 28px; text-align: center; margin-bottom: 24px; }
        h2 { font-size: 24px; border-bottom: 2px solid #002366; padding-bottom: 8px; }
        h3 { font-size: 20px; }
        p { margin-bottom: 16px; text-align: justify; }
        img { 
          max-width: 100%; 
          height: auto; 
          display: block; 
          margin: 16px auto;
          border-radius: 8px;
        }
        ul, ol { margin: 16px 0; padding-left: 24px; }
        li { margin-bottom: 8px; }
        blockquote {
          border-left: 4px solid #4a90e2;
          background: #f0f7ff;
          padding: 12px 16px;
          margin: 16px 0;
          font-style: italic;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 16px 0;
        }
        th, td { 
          border: 1px solid #e5e7eb; 
          padding: 12px;
          text-align: left;
        }
        th { background: #f3f4f6; font-weight: bold; }
        .vocab-item {
          background: #f8fafc;
          border-radius: 12px;
          padding: 16px;
          margin: 12px 0;
          border-left: 4px solid #4a90e2;
        }
        .word {
          font-size: 20px;
          font-weight: bold;
          color: #002366;
          margin-bottom: 4px;
        }
        .translation {
          color: #64748b;
          font-size: 16px;
        }
        .audio-btn {
          background: #4a90e2;
          color: white;
          border: none;
          border-radius: 20px;
          padding: 8px 16px;
          font-size: 14px;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      ${currentHtml}
      <script>
        let scrolled = false;
        window.addEventListener('scroll', () => {
          if (scrolled) return;
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
          if (progress >= 85) {
            scrolled = true;
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'scrollProgress',
              progress: progress
            }));
          }
        });
        document.addEventListener('click', (e) => {
          const btn = e.target.closest('.audio-btn');
          if (btn) {
            const wordId = btn.getAttribute('data-word');
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'playAudio',
              wordId: wordId
            }));
          }
        });
      </script>
    </body>
    </html>
  `;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6] items-center justify-center">
        <ActivityIndicator size="large" color="#002366" />
        <Text className="mt-4 text-gray-600">Chargement du livre...</Text>
        <Text className="mt-2 text-gray-400 text-xs">Extraction du contenu EPUB</Text>
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
          <Text className="text-lg font-bold flex-1">Erreur</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-gray-600 mt-4 text-center">{error}</Text>
          <Pressable
            onPress={refetch}
            className="mt-4 bg-[#002366] px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Réessayer</Text>
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
            {title || epubTitle}
          </Text>
          <Text className="text-xs text-gray-500">
            Chapitre {currentChapter + 1}/{totalChapters}
          </Text>
        </View>
        <Pressable onPress={() => setShowToc(true)} className="p-2">
          <Feather name="menu" size={24} color="#002366" />
        </Pressable>
        {audioFiles.length > 0 && (
          <Pressable onPress={() => setShowAudioPlayer(true)} className="p-2">
            <Feather name="headphones" size={24} color="#002366" />
          </Pressable>
        )}
      </View>

      <View className="px-4 py-2 bg-white">
        <View className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <View 
            className="h-full bg-[#4a90e2] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <View className="flex-1 bg-white mx-3 my-2 rounded-xl overflow-hidden">
        <WebView
          source={{ html: htmlWithStyles }}
          style={{ flex: 1 }}
          onMessage={handleMessage}
          scrollEnabled={true}
          bounces={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          scalesPageToFit={true}
        />
      </View>

      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
        <Pressable
          onPress={previousChapter}
          disabled={!hasPreviousChapter}
          className={`flex-row items-center px-4 py-2 rounded-xl ${
            hasPreviousChapter ? 'bg-gray-100' : 'bg-gray-50 opacity-50'
          }`}
        >
          <Feather name="chevron-left" size={20} color={hasPreviousChapter ? "#002366" : "#9CA3AF"} />
          <Text className={`ml-1 text-sm ${hasPreviousChapter ? 'text-[#002366]' : 'text-gray-400'}`}>
            Préc.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowToc(true)}
          className="px-4 py-2"
        >
          <Text className="text-[#002366] text-sm font-medium">
            {currentChapter + 1}/{totalChapters}
          </Text>
        </Pressable>

        <Pressable
          onPress={nextChapter}
          disabled={!hasNextChapter}
          className={`flex-row items-center px-4 py-2 rounded-xl ${
            hasNextChapter ? 'bg-[#002366]' : 'bg-gray-100 opacity-50'
          }`}
        >
          <Text className={`mr-1 text-sm ${hasNextChapter ? 'text-white' : 'text-gray-400'}`}>
            {hasNextChapter ? 'Suiv.' : 'Fin'}
          </Text>
          <Feather name="chevron-right" size={20} color={hasNextChapter ? "white" : "#9CA3AF"} />
        </Pressable>
      </View>

      <Modal visible={showToc} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="px-5 py-4 border-b border-gray-200 flex-row items-center justify-between">
              <Text className="text-lg font-bold">Table des matières</Text>
              <Pressable onPress={() => setShowToc(false)} className="p-2">
                <Feather name="x" size={24} color="#6B7280" />
              </Pressable>
            </View>
            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => handleChapterSelect(index)}
                  className={`px-5 py-4 border-b border-gray-100 flex-row items-center ${
                    index === currentChapter ? 'bg-blue-50' : ''
                  }`}
                >
                  <Text className={`text-sm font-medium w-8 ${
                    index === currentChapter ? 'text-[#002366]' : 'text-gray-400'
                  }`}>
                    {index + 1}.
                  </Text>
                  <Text className={`flex-1 ${index === currentChapter ? 'text-[#002366] font-bold' : 'text-gray-700'}`}>
                    {item.title}
                  </Text>
                  {index === currentChapter && (
                    <Feather name="check" size={18} color="#002366" />
                  )}
                </Pressable>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showAudioPlayer} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl">
            <View className="px-5 py-4 border-b border-gray-200 flex-row items-center justify-between">
              <Text className="text-lg font-bold">Fichiers Audio</Text>
              <Pressable onPress={() => setShowAudioPlayer(false)} className="p-2">
                <Feather name="x" size={24} color="#6B7280" />
              </Pressable>
            </View>
            <FlatList
              data={audioFiles}
              keyExtractor={(item) => item.href}
              renderItem={({ item, index }) => (
                <Pressable
                  className={`px-5 py-4 border-b border-gray-100 flex-row items-center ${
                    index === currentAudioIndex ? 'bg-blue-50' : ''
                  }`}
                >
                  <View className="w-10 h-10 rounded-full bg-[#4a90e2] items-center justify-center mr-3">
                    <Ionicons name="musical-notes" size={20} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-900">{item.title}</Text>
                  </View>
                  <Pressable className="w-10 h-10 rounded-full bg-[#002366] items-center justify-center">
                    <Ionicons name="play" size={20} color="white" />
                  </Pressable>
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
