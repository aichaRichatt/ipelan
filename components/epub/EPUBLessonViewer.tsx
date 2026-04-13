import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { epubService } from '@/services/epub/epubService';

interface EPUBLessonViewerProps {
  htmlContent?: string;
  epubUrl?: string;
  onAudioPlay?: (wordId: string) => void;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  showProgress?: boolean;
}

export const EPUBLessonViewer: React.FC<EPUBLessonViewerProps> = ({
  htmlContent,
  epubUrl,
  onAudioPlay,
  onProgress,
  onComplete,
  showProgress = true,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState<string>("");

  const loadContent = useCallback(async () => {
    setIsLoading(true);
    try {
      if (htmlContent) {
        setContent(htmlContent);
      } else if (epubUrl) {
        const epubContent = await epubService.loadEPUB(epubUrl);
        const html = epubService.generateHTML(epubContent);
        setContent(html);
      } else {
        const mockHtml = epubService.generateMockLessonHTML();
        setContent(mockHtml);
      }
    } catch (error) {
      console.warn('Failed to load EPUB:', error);
      const mockHtml = epubService.generateMockLessonHTML();
      setContent(mockHtml);
    } finally {
      setIsLoading(false);
    }
  }, [htmlContent, epubUrl]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'playAudio':
          onAudioPlay?.(data.wordId);
          break;
        case 'pageReady':
          setIsLoading(false);
          break;
        case 'scrollProgress':
          const progress = Math.min(100, Math.max(0, data.progress));
          onProgress?.(progress);
          if (progress >= 90) {
            onComplete?.();
          }
          break;
      }
    } catch (error) {
      console.warn('Failed to parse WebView message:', error);
    }
  }, [onAudioPlay, onProgress, onComplete]);

  const injectedJavaScript = `
    (function() {
      window.addEventListener('scroll', function() {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'scrollProgress',
          progress: scrolled
        }));
      });
      
      document.addEventListener('DOMContentLoaded', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pageReady'
        }));
      });
    })();
    true;
  `;

  if (isLoading || !content) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#002366" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: content, baseUrl: 'file:///' }}
        style={styles.webview}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        bounces={true}
        scalesPageToFit={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={true}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        contentMode="mobile"
        pullToRefreshEnabled={false}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error:', nativeEvent.description);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
});

export default EPUBLessonViewer;
