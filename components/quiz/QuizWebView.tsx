import { moodleFetch } from '@/services/api/moodleClient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';

const IS_DEV = process.env.NODE_ENV === 'development';

// Moodle base URL
const MOODLE_BASE_URL = 'https://moodle.richatt.com';

interface QuizWebViewProps {
  quizId: number;
  courseId?: number;
  userToken?: string;
  onComplete?: (score: number, maxScore: number) => void;
  onError?: (error: string) => void;
}

/**
 * QuizWebView - Component to display Moodle quizzes in a WebView
 * 
 * Features:
 * - Auto-authentication using Moodle token
 * - Custom CSS to hide Moodle UI and make it mobile-friendly
 * - JavaScript injection for auto-starting quiz and tracking progress
 * - Loading and error states
 * - Quiz completion detection
 */
export default function QuizWebView({
  quizId,
  courseId,
  userToken,
  onComplete,
  onError,
}: QuizWebViewProps) {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [quizState, setQuizState] = useState<'loading' | 'start' | 'inprogress' | 'finished'>('loading');
  const [loadTimeout, setLoadTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false);
  const [sessionCookie, setSessionCookie] = useState<string | null>(null);

  // Build the quiz URL
  const getQuizUrl = useCallback(() => {
    const url = `${MOODLE_BASE_URL}/mod/quiz/view.php?id=${quizId}`;
    if (IS_DEV) {
      console.log('[QuizWebView] Loading URL:', url);
    }
    return url;
  }, [quizId]);

  // Get Moodle session from WS token
  useEffect(() => {
    const getSession = async () => {
      if (!userToken) {
        setError('Token non disponible. Veuillez vous reconnecter.');
        setIsLoading(false);
        return;
      }

      try {
        if (IS_DEV) {
          console.log('[QuizWebView] Getting session from token...');
        }

        // Step 1: Get site info to validate token and get user info
        const response = await moodleFetch('/webservice/rest/server.php', {
          wstoken: userToken,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json',
        });

        if (response?.exception) {
          throw new Error(response.message || 'Failed to get session');
        }

        if (IS_DEV) {
          console.log('[QuizWebView] Token valid for user:', response?.fullname);
        }

        // Step 2: Try to get a web session via alternative method
        // Create a URL that includes the token for auto-login
        // This uses Moodle's token-based login redirection
        const loginUrl = `${MOODLE_BASE_URL}/login/index.php?token=${userToken}&redirect=${encodeURIComponent(`/mod/quiz/view.php?id=${quizId}`)}`;
        
        if (IS_DEV) {
          console.log('[QuizWebView] Login URL:', loginUrl);
        }

        // Try to pre-fetch to establish cookies
        try {
          const preFetch = await fetch(loginUrl, {
            method: 'GET',
            redirect: 'manual',
          });
          
          // Extract cookies from response
          const cookies = preFetch.headers.get('set-cookie') || '';
          const sessionMatch = cookies.match(/MoodleSession=([^;]+)/);
          
          if (sessionMatch) {
            const sessionKey = sessionMatch[1];
            if (IS_DEV) {
              console.log('[QuizWebView] Got session cookie');
            }
            setSessionCookie(sessionKey);
          } else {
            // No session cookie - use sharedCookies approach
            setSessionCookie('shared');
          }
        } catch (fetchErr) {
          // fetch with redirect:manual may fail, that's ok
          setSessionCookie('shared');
        }
      } catch (err: any) {
        console.warn('[QuizWebView] Failed to get session:', err);
        // Don't fail - try loading anyway, WebView might have existing session
        setSessionCookie('fallback');
      }
    };

    getSession();
  }, [userToken, quizId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    };
  }, [loadTimeout]);

  // Custom CSS to hide Moodle UI and make it mobile-friendly
  const injectedCSS = `
    <style>
      /* Hide Moodle header, footer, navigation */
      #page-header,
      #page-footer,
      .navbar,
      .nav-drawer,
      .fixed-top,
      .moodle-core-plugin-wrapper,
      .activity-navigation,
      .breadcrumb,
      .context-header,
      .page-context-header,
      #nav-drawer,
      #nav-drawer-footer,
      .drawer-toggle,
      .side-pre,
      .block-region,
      .moodle-dialogue,
      .moodle-dialogue-base,
      .modal,
      .modal-backdrop {
        display: none !important;
      }
      
      /* Hide sidebars */
      #region-main-box,
      #region-pre,
      #region-post {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      /* Main content area */
      #region-main {
        padding: 16px !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      
      /* Quiz container */
      #mod_quiz_navblock,
      .quizattempt,
      .que {
        max-width: 100% !important;
        padding: 16px !important;
        margin: 0 0 16px 0 !important;
        box-sizing: border-box !important;
      }
      
      /* Increase font sizes */
      body {
        font-size: 18px !important;
        line-height: 1.6 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        background-color: #FAF9F6 !important;
        color: #333 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      h1, h2, h3, h4 {
        font-size: 24px !important;
        color: #002366 !important;
        margin-bottom: 16px !important;
      }
      
      /* Question styling */
      .que .content {
        font-size: 18px !important;
        line-height: 1.6 !important;
      }
      
      .que .qtext {
        font-size: 20px !important;
        font-weight: 600 !important;
        color: #1a1a1a !important;
        margin-bottom: 20px !important;
      }
      
      /* Answer options - Duolingo style */
      .answer div,
      .que.multichoice .answer .r0,
      .que.multichoice .answer .r1,
      .que.truefalse .answer .r0,
      .que.truefalse .answer .r1 {
        display: block !important;
        padding: 16px !important;
        margin: 12px 0 !important;
        background: white !important;
        border: 2px solid #e5e7eb !important;
        border-radius: 16px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        font-size: 17px !important;
      }
      
      .answer div:hover,
      .que.multichoice .answer .r0:hover,
      .que.multichoice .answer .r1:hover,
      .que.truefalse .answer .r0:hover,
      .que.truefalse .answer .r1:hover {
        border-color: #4a90e2 !important;
        background-color: #f0f9ff !important;
      }
      
      .answer input[type="radio"] {
        width: 24px !important;
        height: 24px !important;
        margin-right: 12px !important;
        accent-color: #4a90e2 !important;
      }
      
      /* Buttons - Duolingo style */
      .btn,
      button[type="submit"],
      input[type="submit"],
      .mod_quiz-next-nav,
      .mod_quiz-prev-nav,
      .mod_quiz-end-test {
        display: block !important;
        width: 100% !important;
        padding: 18px 24px !important;
        margin: 16px 0 !important;
        font-size: 18px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        border-radius: 16px !important;
        border: none !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        text-align: center !important;
      }
      
      /* Primary button (green like Duolingo) */
      .btn-primary,
      button[type="submit"]:not(.mod_quiz-prev-nav):not(.mod_quiz-end-test),
      .mod_quiz-next-nav {
        background-color: #58CC02 !important;
        color: white !important;
        box-shadow: 0 4px 0 #58A700 !important;
      }
      
      .btn-primary:active,
      button[type="submit"]:active:not(.mod_quiz-prev-nav):not(.mod_quiz-end-test),
      .mod_quiz-next-nav:active {
        box-shadow: 0 2px 0 #58A700 !important;
        transform: translateY(2px) !important;
      }
      
      /* Secondary button (blue) */
      .btn-secondary,
      .mod_quiz-prev-nav {
        background-color: #4a90e2 !important;
        color: white !important;
        box-shadow: 0 4px 0 #3B7BC0 !important;
      }
      
      /* End test button (orange) */
      .mod_quiz-end-test {
        background-color: #F59E0B !important;
        color: white !important;
        box-shadow: 0 4px 0 #D97706 !important;
      }
      
      /* Timer */
      .quiz-timer {
        font-size: 16px !important;
        font-weight: 600 !important;
        color: #F59E0B !important;
        text-align: center !important;
        padding: 12px !important;
        background: #fffbeb !important;
        border-radius: 12px !important;
        margin-bottom: 16px !important;
      }
      
      /* Question info */
      .quizinfo {
        font-size: 14px !important;
        color: #6b7280 !important;
        text-align: center !important;
        margin-bottom: 16px !important;
      }
      
      /* Progress bar */
      .progress-bar {
        height: 8px !important;
        background-color: #e5e7eb !important;
        border-radius: 4px !important;
        margin-bottom: 20px !important;
        overflow: hidden !important;
      }
      
      .progress-bar-fill {
        height: 100% !important;
        background-color: #58CC02 !important;
        transition: width 0.3s ease !important;
      }
      
      /* Summary page */
      .quiz-summary {
        text-align: center !important;
        padding: 24px 16px !important;
      }
      
      .quiz-summary h2 {
        font-size: 28px !important;
        color: #002366 !important;
        margin-bottom: 24px !important;
      }
      
      .quiz-summary .grade {
        font-size: 48px !important;
        font-weight: 800 !important;
        color: #58CC02 !important;
        margin: 24px 0 !important;
      }
      
      /* Hide unnecessary elements on summary */
      .quiz-summary .submitbtns,
      .quiz-summary .quizreviewsummary {
        display: none !important;
      }
      
      /* Loading overlay */
      #page-content::before {
        content: '' !important;
        display: none !important;
      }
      
      /* Ensure quiz content is visible */
      #mod_quiz_view,
      .quizstartbuttondiv,
      .quizattempt {
        display: block !important;
      }
      
      /* Hide edit mode elements */
      .editmode,
      .editing,
      .edit-button,
      .moodle-actionmenu,
      .menu-action-text {
        display: none !important;
      }
    </style>
  `;

  // Simplified JavaScript for auto-starting and tracking
  const injectedJavaScript = `
    (function() {
      // Inject CSS first
      var css = \`${injectedCSS.replace(/<style>|<\/style>/g, '').replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`;
      var style = document.createElement('style');
      style.innerHTML = css;
      document.head.appendChild(style);
      console.log('[QuizWebView] CSS injected');
      
      let quizFinished = false;
      let checkInterval = null;
      
      function sendMessage(data) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
        }
      }
      
      // Auto-click start button
      function autoStartQuiz() {
        var buttons = document.querySelectorAll('input[type="submit"], button[type="submit"]');
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          var value = btn.value || btn.textContent || '';
          if (value.toLowerCase().includes('attempt') || 
              value.toLowerCase().includes('commencer') ||
              value.toLowerCase().includes('start')) {
            btn.click();
            sendMessage({ type: 'QUIZ_STARTED' });
            return true;
          }
        }
        return false;
      }
      
      // Check if quiz is finished
      function checkFinished() {
        if (quizFinished) return;
        
        var gradeEl = document.querySelector('.grade');
        var summaryEl = document.querySelector('.quizattemptsummary, .endtestlink');
        
        if (gradeEl || summaryEl) {
          quizFinished = true;
          
          var score = 0;
          var maxScore = 0;
          
          if (gradeEl) {
            var text = gradeEl.textContent || '';
            var match = text.match(/(\d+(?:\\.\\d+)?)\\s*\/\\s*(\d+(?:\\.\\d+)?)/);
            if (match) {
              score = parseFloat(match[1]) || 0;
              maxScore = parseFloat(match[2]) || 0;
            }
          }
          
          sendMessage({
            type: 'QUIZ_FINISHED',
            score: score,
            maxScore: maxScore,
            url: window.location.href
          });
          
          if (checkInterval) {
            clearInterval(checkInterval);
          }
        }
      }
      
      // Initialize
      function init() {
        console.log('[QuizWebView] JS initialized');
        
        // Try to auto-start
        setTimeout(autoStartQuiz, 1000);
        
        // Check for completion every 2 seconds
        checkInterval = setInterval(checkFinished, 2000);
        
        // Send initial message
        sendMessage({
          type: 'NAVIGATION',
          url: window.location.href
        });
      }
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    })();
    true;
  `;

  // Handle messages from WebView
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (IS_DEV) {
        console.log('[QuizWebView] Message:', data);
      }
      
      switch (data.type) {
        case 'QUIZ_FINISHED':
          setQuizState('finished');
          onComplete?.(data.score, data.maxScore);
          break;
          
        case 'NAVIGATION':
          if (data.url?.includes('summary')) {
            setQuizState('finished');
          } else if (data.url?.includes('attempt')) {
            setQuizState('inprogress');
          }
          break;
          
        case 'FORM_SUBMIT':
          // Form was submitted, quiz might be progressing
          break;
      }
    } catch (err) {
      if (IS_DEV) {
        console.log('[QuizWebView] Raw message:', event.nativeEvent.data);
      }
    }
  }, [onComplete]);

  // Handle navigation state changes
  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    const url = navState.url;
    setCurrentUrl(url);
    
    // Clear any existing timeout
    if (loadTimeout) {
      clearTimeout(loadTimeout);
    }
    
    // Check if redirecting to login page
    if (url.includes('/login/') || url.includes('login.php')) {
      if (IS_DEV) {
        console.log('[QuizWebView] Detected redirect to login page');
      }
      setIsRedirectingToLogin(true);
      setError('Session expirée. Veuillez vous reconnecter dans l\'application.');
      setIsLoading(false);
      return;
    }
    
    // Detect quiz state based on URL
    if (url.includes('summary.php') || url.includes('review.php')) {
      setQuizState('finished');
    } else if (url.includes('attempt.php')) {
      setQuizState('inprogress');
      setIsRedirectingToLogin(false);
    } else if (url.includes('view.php')) {
      setQuizState('start');
      setIsRedirectingToLogin(false);
    }
    
    // Set a timeout to detect if loading is stuck
    if (!url.includes('login')) {
      const timeout = setTimeout(() => {
        if (IS_DEV) {
          console.log('[QuizWebView] Load timeout check - URL:', url);
        }
        // If still loading after 15 seconds, check if we need to show error
        // But don't show error if we're on a valid quiz page
      }, 15000);
      setLoadTimeout(timeout);
    }
    
    if (IS_DEV) {
      console.log('[QuizWebView] Navigation:', url, 'State:', quizState);
    }
  }, [quizState, loadTimeout]);

  // Handle errors
  const handleError = useCallback((error: any) => {
    const errorMessage = error?.description || 'Failed to load quiz';
    setError(errorMessage);
    setIsLoading(false);
    onError?.(errorMessage);
  }, [onError]);

  // Handle back button
  const handleBack = useCallback(() => {
    if (webViewRef.current && currentUrl !== getQuizUrl()) {
      webViewRef.current.goBack();
    } else {
      // Show confirmation if quiz is in progress
      if (quizState === 'inprogress') {
        Alert.alert(
          'Quitter le quiz ?',
          'Votre progression sera perdue.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: () => router.back() }
          ]
        );
      } else {
        router.back();
      }
    }
  }, [currentUrl, getQuizUrl, quizState, router]);

  // Loading screen with timeout message
  if (isLoading && !error) {
    return (
      <View className="flex-1 bg-[#FAF9F6]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <Pressable onPress={handleBack} className="p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="#374151" />
          </Pressable>
          <Text className="text-lg font-bold text-[#002366]">Quiz</Text>
          <View className="w-10" />
        </View>
        
        {/* Loading indicator */}
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text className="mt-4 text-gray-500 text-center">Chargement du quiz...</Text>
          <Text className="mt-2 text-gray-400 text-sm text-center">
            Si le chargement prend trop de temps, vérifiez votre connexion
          </Text>
          
          {/* Force reload button - shown after 5 seconds */}
          <Pressable
            onPress={() => {
              webViewRef.current?.reload();
            }}
            className="mt-6 bg-gray-200 px-6 py-3 rounded-xl"
          >
            <Text className="text-gray-700 font-bold">Forcer le rechargement</Text>
          </Pressable>
          
          <Pressable
            onPress={handleBack}
            className="mt-3 px-6 py-3"
          >
            <Text className="text-gray-500">Annuler</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Error screen
  if (error) {
    return (
      <View className="flex-1 bg-[#FAF9F6]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
          <Pressable onPress={handleBack} className="p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="#374151" />
          </Pressable>
          <Text className="text-lg font-bold text-[#002366]">Quiz</Text>
          <View className="w-10" />
        </View>
        
        {/* Error message */}
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
            <Feather name="alert-circle" size={32} color="#EF4444" />
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
            Erreur de chargement
          </Text>
          <Text className="text-gray-500 text-center mb-6">
            {error}
          </Text>
          <Pressable
            onPress={() => {
              setError(null);
              setIsLoading(true);
              webViewRef.current?.reload();
            }}
            className="bg-[#4a90e2] px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Réessayer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#FAF9F6]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Pressable onPress={handleBack} className="p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="#374151" />
        </Pressable>
        <Text className="text-lg font-bold text-[#002366]">
          {quizState === 'finished' ? 'Résultats' : 'Quiz'}
        </Text>
        <View className="w-10" />
      </View>
      
      {/* Progress indicator */}
      {quizState === 'inprogress' && (
        <View className="h-1 bg-gray-200">
          <View className="h-full bg-[#58CC02]" style={{ width: '50%' }} />
        </View>
      )}
      
      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{
          uri: getQuizUrl(),
          headers: sessionCookie && sessionCookie !== 'fallback' 
            ? { Cookie: `MoodleSession=${sessionCookie}` } 
            : undefined,
        }}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={() => {
          setIsLoading(true);
          if (IS_DEV) console.log('[QuizWebView] Load started');
        }}
        onLoadEnd={() => {
          setIsLoading(false);
          if (IS_DEV) console.log('[QuizWebView] Load ended');
        }}
        onError={handleError}
        onHttpError={(event) => {
          if (IS_DEV) {
            console.warn('[QuizWebView] HTTP error:', event.nativeEvent);
          }
          if (event.nativeEvent.statusCode === 403 || event.nativeEvent.statusCode === 401) {
            setError('Accès refusé. Veuillez vous reconnecter.');
            setIsLoading(false);
          }
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#4a90e2" />
          </View>
        )}
        // Performance optimizations
        androidLayerType="hardware"
        // Security
        mixedContentMode="never"
        allowsFullscreenVideo={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Memory management
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        // User agent to appear as mobile
        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
});
