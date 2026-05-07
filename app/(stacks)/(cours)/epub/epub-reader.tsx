import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useSelector } from "react-redux";
import { useEpubReader } from "../../../../hooks/useEpubReader";
import { RootState } from "../../../../services/redux/store";

const styles = StyleSheet.create({
  bgwhite_roundedt3xl: {
    backgroundColor: '#FFFFFF'
  },
  bgwhite_roundedt3xl_maxh70: {
    backgroundColor: '#FFFFFF'
  },
  flex1: {
    flex: 1
  },
  flex1_bgblack50_justifyend: {
    flex: 1,
    justifyContent: 'flex-end'
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
  flex1_bgwhite_mx3_my2_roundedx: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 12,
    marginVertical: 8,
    overflow: 'hidden'
  },
  flex1_itemscenter_justifycente: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  flexrow_itemscenter_justifybet: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  h1_bggray200_roundedfull_overf: {
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    height: 4,
    overflow: 'hidden'
  },
  hfull_bg4a90e2_roundedfull_tra: {
    backgroundColor: '#4a90e2',
    borderRadius: 9999,
    height: '100%'
  },
  mr4_p2: {
    marginRight: 16,
    padding: 8
  },
  mt2_textgray400_textxs: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8
  },
  mt4_bg002366_px6_py3_roundedxl: {
    backgroundColor: '#002366',
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12
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
  px4_py2: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  px4_py2_bgwhite: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8
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
  px5_py4_borderb_bordergray200_: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  px5_py4_flexrow_itemscenter: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_1: {
    padding: 8
  },
  style_2: {
    fontSize: 18,
    fontWeight: '700'
  },
  style_3: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_4: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  style_5: {
    padding: 8
  },
  style_6: {
    padding: 8
  },
  style_7: {
    flex: 1
  },
  style_8: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  text002366_textsm_fontmedium: {
    color: '#002366',
    fontSize: 14,
    fontWeight: '500'
  },
  textbase_fontbold_textgray900: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700'
  },
  textgray600_mt4_textcenter: {
    color: '#4B5563',
    marginTop: 16,
    textAlign: 'center'
  },
  textlg_fontbold: {
    fontSize: 18,
    fontWeight: '700'
  },
  textlg_fontbold_flex1: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700'
  },
  textsm_fontmedium_textgray900: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500'
  },
  textwhite_fontbold: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  textxs_textgray500: {
    color: '#6B7280',
    fontSize: 12
  },
  w10_h10_roundedfull_bg002366_i: {
    alignItems: 'center',
    backgroundColor: '#002366',
    borderRadius: 9999,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  w10_h10_roundedfull_bg4a90e2_i: {
    alignItems: 'center',
    backgroundColor: '#4a90e2',
    borderRadius: 9999,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
    width: 40
  },
});

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
      <SafeAreaView style={styles.flex1_bgFAF9F6_itemscenter_jus}>
        <ActivityIndicator size="large" color="#002366" />
        <Text style={styles.mt4_textgray600}>Chargement du livre...</Text>
        <Text style={styles.mt2_textgray400_textxs}>Extraction du contenu EPUB</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.style_8} edges={["top"]}>
        <View style={styles.px5_py4_flexrow_itemscenter}>
          <Pressable onPress={() => router.back()} style={styles.mr4_p2}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.textlg_fontbold_flex1}>Erreur</Text>
        </View>
        <View style={styles.flex1_itemscenter_justifycente}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.textgray600_mt4_textcenter}>{error}</Text>
          <Pressable
            onPress={refetch}
            style={styles.mt4_bg002366_px6_py3_roundedxl}
          >
            <Text style={styles.textwhite_fontbold}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={["top"]}>
      <View style={styles.px4_py3_flexrow_itemscenter_bg}>
        <Pressable onPress={() => router.back()} style={styles.p2_mr2}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View style={styles.style_7}>
          <Text style={styles.textbase_fontbold_textgray900} numberOfLines={1}>
            {title || epubTitle}
          </Text>
          <Text style={styles.textxs_textgray500}>
            Chapitre {currentChapter + 1}/{totalChapters}
          </Text>
        </View>
        <Pressable onPress={() => setShowToc(true)} style={styles.style_6}>
          <Feather name="menu" size={24} color="#002366" />
        </Pressable>
        {audioFiles.length > 0 && (
          <Pressable onPress={() => setShowAudioPlayer(true)} style={styles.style_5}>
            <Feather name="headphones" size={24} color="#002366" />
          </Pressable>
        )}
      </View>

      <View style={styles.px4_py2_bgwhite}>
        <View style={styles.h1_bggray200_roundedfull_overf}>
          <View 
            style={[styles.hfull_bg4a90e2_roundedfull_tra,{width: `${progress}%` }]}
           />
        </View>
      </View>

      <View style={styles.flex1_bgwhite_mx3_my2_roundedx}>
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

      <View style={styles.flexrow_itemscenter_justifybet}>
        <Pressable
          onPress={previousChapter}
          disabled={!hasPreviousChapter}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: hasPreviousChapter ? '#F3F4F6' : '#F9FAFB',
            opacity: hasPreviousChapter ? 1 : 0.5,
          }}
        >
          <Feather name="chevron-left" size={20} color={hasPreviousChapter ? "#002366" : "#9CA3AF"} />
          <Text style={{
            marginLeft: 4,
            fontSize: 14,
            color: hasPreviousChapter ? '#002366' : '#9CA3AF',
          }}>
            Préc.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowToc(true)}
          style={styles.px4_py2}
        >
          <Text style={styles.text002366_textsm_fontmedium}>
            {currentChapter + 1}/{totalChapters}
          </Text>
        </Pressable>

        <Pressable
          onPress={nextChapter}
          disabled={!hasNextChapter}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: hasNextChapter ? '#002366' : '#F3F4F6',
            opacity: hasNextChapter ? 1 : 0.5,
          }}
        >
          <Text style={{
            marginRight: 4,
            fontSize: 14,
            color: hasNextChapter ? '#FFFFFF' : '#9CA3AF',
          }}>
            {hasNextChapter ? 'Suiv.' : 'Fin'}
          </Text>
          <Feather name="chevron-right" size={20} color={hasNextChapter ? "white" : "#9CA3AF"} />
        </Pressable>
      </View>

      <Modal visible={showToc} animationType="slide" transparent={true}>
        <View style={styles.style_4}>
          <View style={styles.bgwhite_roundedt3xl_maxh70}>
            <View style={styles.style_3}>
              <Text style={styles.style_2}>Table des matières</Text>
              <Pressable onPress={() => setShowToc(false)} style={styles.style_1}>
                <Feather name="x" size={24} color="#6B7280" />
              </Pressable>
            </View>
            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => handleChapterSelect(index)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: index === currentChapter ? '#EFF6FF' : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '500',
                    width: 32,
                    color: index === currentChapter ? '#002366' : '#9CA3AF',
                  }}>
                    {index + 1}.
                  </Text>
                  <Text style={{
                    flex: 1,
                    color: index === currentChapter ? '#002366' : '#374151',
                    fontWeight: index === currentChapter ? '700' : '400',
                  }}>
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
        <View style={styles.flex1_bgblack50_justifyend}>
          <View style={styles.bgwhite_roundedt3xl}>
            <View style={styles.px5_py4_borderb_bordergray200_}>
              <Text style={styles.textlg_fontbold}>Fichiers Audio</Text>
              <Pressable onPress={() => setShowAudioPlayer(false)} style={styles.p2}>
                <Feather name="x" size={24} color="#6B7280" />
              </Pressable>
            </View>
            <FlatList
              data={audioFiles}
              keyExtractor={(item) => item.href}
              renderItem={({ item, index }) => (
                <Pressable
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: index === currentAudioIndex ? '#EFF6FF' : 'transparent',
                  }}
                >
                  <View style={styles.w10_h10_roundedfull_bg4a90e2_i}>
                    <Ionicons name="musical-notes" size={20} color="white" />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.textsm_fontmedium_textgray900}>{item.title}</Text>
                  </View>
                  <Pressable style={styles.w10_h10_roundedfull_bg002366_i}>
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
