import ENV from '@/constants/env';
import { moodleFetch } from '@/services/api/moodleClient';
import { getCredentials } from '@/services/storage/tokenStorage';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';

const IS_DEV = process.env.NODE_ENV === 'development';

// Moodle base URL
const MOODLE_BASE_URL = ENV.API.MOODLE_URL ;

interface QuizWebViewProps {
  quizId: number;
  courseId?: number;
  userToken?: string;
  onComplete?: (score: number, maxScore: number) => void;
  onError?: (error: string) => void;
}

function makeLoginForm(user: string, pass: string, dest: string): string {
  const safeUser = user.replace(/"/g, '&quot;');
  const safePass = pass.replace(/"/g, '&quot;');
  const safeDest = dest.replace(/"/g, '&quot;');

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#EEF2FF;font-family:system-ui,-apple-system}
  .card{background:white;padding:32px;border-radius:20px;text-align:center;box-shadow:0 4px 20px rgba(0,34,102,.1);max-width:300px;width:90%}
  .logo{font-size:48px;margin-bottom:16px}
  h2{color:#002366;margin:0 0 8px;font-size:20px}
  p{color:#666;margin:0 0 24px;font-size:14px}
  .spinner{width:40px;height:40px;border:3px solid #EEF2FF;border-top:3px solid #002366;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto}
  @keyframes spin{to{transform:rotate(360deg)}}
</style></head><body>
<div class="card">
  <div class="logo">📚</div>
  <h2>IPELAN</h2>
  <p>Connexion en cours...</p>
  <div class="spinner"></div>
</div>
<form id="loginForm" method="POST" action="${MOODLE_BASE_URL}/login/index.php" style="display:none">
  <input name="username" value="${safeUser}">
  <input name="password" value="${safePass}" type="password">
  <input name="wantsurl" value="${safeDest}">
  <input name="logintoken" value="" id="tok">
  <input name="anchor" value="">
  <input name="rememberusername" value="1">
</form>
<script>
  fetch('${MOODLE_BASE_URL}/login/index.php')
    .then(r => r.text())
    .then(html => {
      const m = html.match(/name="logintoken"[^>]*value="([^"]+)"/);
      if (m && m[1]) document.getElementById('tok').value = m[1];
      document.getElementById('loginForm').submit();
    })
    .catch(() => document.getElementById('loginForm').submit());
</script>
</body></html>`;
}

 
const styles = StyleSheet.create({
  bg4a90e2_px6_py3_roundedxl_mb3: {
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  flex1_bgFAF9F6: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  flex1_itemscenter_justifycente: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  flexrow_itemscenter_justifybet: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  h1_bggray200: {
    backgroundColor: '#E5E7EB',
    height: 4
  },
  hfull_bg58CC02: {
    backgroundColor: '#58CC02',
    height: '100%'
  },
  mt2_textgray400_textsm_textcen: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  mt3_px6_py3: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  mt4_textgray500_textcenter: {
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center'
  },
  mt6_bggray200_px6_py3_roundedx: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  p2_ml2: {
    marginLeft: -8,
    padding: 8
  },
  px6_py3: {
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  px6_py3_mb2: {
    marginBottom: 8,
    paddingHorizontal: 24,
    paddingVertical: 12
  },
  style_1: {
    width: 40
  },
  style_10: {
    marginLeft: -8,
    padding: 8
  },
  style_11: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  style_12: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_2: {
    color: '#002366',
    fontSize: 18,
    fontWeight: '700'
  },
  style_3: {
    marginLeft: -8,
    padding: 8
  },
  style_4: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  style_5: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  style_6: {
    color: '#6B7280'
  },
  style_7: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  style_8: {
    width: 40
  },
  style_9: {
    color: '#002366',
    fontSize: 18,
    fontWeight: '700'
  },
  textgray400_textsm_textcenter_: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center'
  },
  textgray500: {
    color: '#6B7280'
  },
  textgray500_fontmedium: {
    color: '#6B7280',
    fontWeight: '500'
  },
  textgray500_textcenter_mb2: {
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center'
  },
  textgray700_fontbold: {
    color: '#374151',
    fontWeight: '700'
  },
  textlg_fontbold_text002366: {
    color: '#002366',
    fontSize: 18,
    fontWeight: '700'
  },
  textwhite_fontbold: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  textxl_fontbold_textgray900_mb: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  w10: {
    width: 40
  },
  w16_h16_roundedfull_bgamber100: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 9999,
    height: 64,
    justifyContent: 'center',
    marginBottom: 16,
    width: 64
  },
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
  const [source, setSource] = useState<React.ComponentProps<typeof WebView>['source'] | null>(null);

  // Build the quiz URL
  const getQuizUrl = useCallback(() => {
    const url = `${MOODLE_BASE_URL}/mod/quiz/view.php?id=${quizId}`;
    if (IS_DEV) {
      console.log('[QuizWebView] Quiz URL:', url);
    }
    return url;
  }, [quizId]);

  useEffect(() => {
    const getSession = async () => {
      const quizUrl = getQuizUrl();
      const credentials = await getCredentials();

      if (credentials?.username && credentials?.password) {
        if (IS_DEV) {
          console.log('[QuizWebView] Stored credentials found, using login form');
        }

        setSource({ html: makeLoginForm(credentials.username, credentials.password, quizUrl), baseUrl: MOODLE_BASE_URL });
        setIsLoading(false);
        return;
      }

      if (!userToken) {
        setError('Token non disponible. Veuillez vous reconnecter.');
        setSource({ uri: quizUrl });
        setIsLoading(false);
        return;
      }

      try {
        if (IS_DEV) {
          console.log('[QuizWebView] Validating token...');
        }

        const response = await moodleFetch('/webservice/rest/server.php', {
          wstoken: userToken,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json',
        });

        if (response?.exception) {
          throw new Error(response.message || 'Token invalide');
        }

        if (IS_DEV) {
          console.log('[QuizWebView] Token valid for user:', response?.fullname || response?.username);
        }

        if (courseId) {
          try {
            const enrolledCourses = await moodleFetch('/webservice/rest/server.php', {
              wstoken: userToken,
              wsfunction: 'core_enrol_get_users_courses',
              userid: response?.userid || 0,
              moodlewsrestformat: 'json',
            });

            if (enrolledCourses && !enrolledCourses.exception && Array.isArray(enrolledCourses)) {
              const isEnrolled = enrolledCourses.some((c: any) => c.id === courseId);
              if (IS_DEV) {
                console.log('[QuizWebView] User enrolled in course', courseId, ':', isEnrolled);
              }
              if (!isEnrolled) {
                setError(`Vous n'êtes pas inscrit au cours #${courseId}. Veuillez vous inscrire sur Moodle pour accéder aux quiz.`);
                setIsLoading(false);
                return;
              }
            }
          } catch (enrolErr) {
            if (IS_DEV) {
              console.log('[QuizWebView] Could not verify enrolment:', enrolErr);
            }
          }
        }

        setSource({ uri: quizUrl });
        setIsLoading(false);
      } catch (err: any) {
        console.warn('[QuizWebView] Failed to validate token:', err);
        setSource({ uri: quizUrl });
        setIsLoading(false);
      }
    };

    getSession();
  }, [courseId, getQuizUrl, quizId, userToken]);

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
      
      // Check for error messages on the page
      function checkForErrors() {
        var pageText = document.body.innerText || '';
        var pageHtml = document.body.innerHTML || '';
        
        // Check for common Moodle error messages
        var errorPatterns = [
          { pattern: /not.*enrolled|must.*enrol|inscription.*requise|doit.*inscrit/i, type: 'NOT_ENROLLED' },
          { pattern: /not.*available.*yet|pas.*encore.*disponible/i, type: 'NOT_AVAILABLE' },
          { pattern: /do.*not.*have.*permission|accès.*refusé|permission.*refusée/i, type: 'NO_PERMISSION' },
          { pattern: /activity.*closed|quiz.*closed|fermé/i, type: 'QUIZ_CLOSED' },
          { pattern: /attempts.*allowed|tentatives.*autorisées|no.*more.*attempts/i, type: 'NO_ATTEMPTS' },
          { pattern: /error.*accessing.*quiz|erreur.*accès/i, type: 'ACCESS_ERROR' }
        ];
        
        for (var j = 0; j < errorPatterns.length; j++) {
          if (errorPatterns[j].pattern.test(pageText) || errorPatterns[j].pattern.test(pageHtml)) {
            sendMessage({ 
              type: 'QUIZ_ERROR', 
              errorType: errorPatterns[j].type,
              message: pageText.substring(0, 200)
            });
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
        
        // Check for errors first
        setTimeout(checkForErrors, 500);
        
        // Try to auto-start
        setTimeout(autoStartQuiz, 1000);
        
        // Check for completion and errors every 2 seconds
        checkInterval = setInterval(function() {
          checkFinished();
          checkForErrors();
        }, 2000);
        
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

        case 'QUIZ_ERROR':
          // Handle errors detected in the page
          let errorMsg = 'Une erreur est survenue lors de l\'accès au quiz.';
          switch (data.errorType) {
            case 'NOT_ENROLLED':
              errorMsg = 'Vous n\'êtes pas inscrit à ce cours. Veuillez vous inscrire sur Moodle pour accéder au quiz.';
              break;
            case 'NO_PERMISSION':
              errorMsg = 'Vous n\'avez pas la permission d\'accéder à ce quiz.';
              break;
            case 'QUIZ_CLOSED':
              errorMsg = 'Ce quiz est fermé ou n\'est plus disponible.';
              break;
            case 'NOT_AVAILABLE':
              errorMsg = 'Ce quiz n\'est pas encore disponible ou a expiré.';
              break;
            case 'NO_ATTEMPTS':
              errorMsg = 'Vous avez épuisé toutes vos tentatives pour ce quiz.';
              break;
          }
          setError(errorMsg);
          setIsLoading(false);
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
    } catch {
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
        console.log('[QuizWebView] Detected redirect to login page - URL:', url);
        console.log('[QuizWebView] User token available:', !!userToken);
      }
      setError('Authentification requise. Le quiz Moodle nécessite une connexion via navigateur. Veuillez ouvrir le quiz dans votre navigateur.');
      setIsLoading(false);
      return;
    }

    // Check if redirecting to enrolment page - user not enrolled in course
    if (url.includes('/enrol/') || url.includes('enrol.php')) {
      if (IS_DEV) {
        console.log('[QuizWebView] Detected redirect to enrolment page - URL:', url);
      }
      setError('Vous n\'êtes pas inscrit à ce cours. Veuillez vous inscrire sur Moodle pour accéder au quiz.');
      setIsLoading(false);
      return;
    }

    // Check if redirected to course page instead of quiz - access denied
    if (url.includes('/course/view.php') && courseId && url.includes(`id=${courseId}`)) {
      if (IS_DEV) {
        console.log('[QuizWebView] Redirected to course page, quiz not accessible - URL:', url);
      }
      // Only show error if we were trying to access a quiz
      if (!url.includes('/mod/quiz/')) {
        setError('Ce quiz n\'est pas accessible. Vérifiez que vous êtes inscrit au cours et que le quiz est disponible.');
        setIsLoading(false);
        return;
      }
    }
    
    // Detect quiz state based on URL
    if (url.includes('summary.php') || url.includes('review.php')) {
      setQuizState('finished');
      setIsLoading(false);
    } else if (url.includes('attempt.php')) {
      setQuizState('inprogress');
      setIsLoading(false);
    } else if (url.includes('/mod/quiz/')) {
      if (url.includes('view.php')) {
        setQuizState('start');
      }
      setIsLoading(false);
      if (IS_DEV) {
        console.log('[QuizWebView] Quiz page loaded:', url);
      }
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
  }, [quizState, loadTimeout, userToken, courseId]);

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

  // Loading screen with timeout message - also wait for source to be ready
  if ((isLoading || !source) && !error) {
    return (
      <View style={styles.style_12}>
        {/* Header */}
        <View style={styles.style_11}>
          <Pressable onPress={handleBack} style={styles.style_10}>
            <Feather name="arrow-left" size={24} color="#374151" />
          </Pressable>
          <Text style={styles.style_9}>Quiz</Text>
          <View style={styles.style_8} />
        </View>
        
        {/* Loading indicator */}
        <View style={styles.style_7}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.mt4_textgray500_textcenter}>
            {!source ? 'Préparation de l\'authentification...' : 'Chargement du quiz...'}
          </Text>
          {!source && (
            <Text style={styles.mt2_textgray400_textsm_textcen}>
              Vérification de votre accès au cours...
            </Text>
          )}
          
          {/* Force reload button - shown after 5 seconds */}
          {source && (
            <Pressable
              onPress={() => {
                webViewRef.current?.reload();
              }}
              style={styles.mt6_bggray200_px6_py3_roundedx}
            >
              <Text style={styles.textgray700_fontbold}>Forcer le rechargement</Text>
            </Pressable>
          )}
          
          <Pressable
            onPress={handleBack}
            style={styles.mt3_px6_py3}
          >
            <Text style={styles.style_6}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Error screen
  if (error) {
    return (
      <View style={styles.style_5}>
        {/* Header */}
        <View style={styles.style_4}>
          <Pressable onPress={handleBack} style={styles.style_3}>
            <Feather name="arrow-left" size={24} color="#374151" />
          </Pressable>
          <Text style={styles.style_2}>Quiz</Text>
          <View style={styles.style_1} />
        </View>
        
        {/* Error message */}
        <View style={styles.flex1_itemscenter_justifycente}>
          <View style={styles.w16_h16_roundedfull_bgamber100}>
            <Feather name="lock" size={32} color="#F59E0B" />
          </View>
          <Text style={styles.textxl_fontbold_textgray900_mb}>
            Accès au quiz
          </Text>
          <Text style={styles.textgray500_textcenter_mb2}>
            {error}
          </Text>
          <Text style={styles.textgray400_textsm_textcenter_}>
            L&apos;authentification automatique ne fonctionne pas. Vous pouvez ouvrir le quiz dans votre navigateur en vous connectant avec vos identifiants.
          </Text>
          <Pressable
            onPress={() => {
              const quizUrl = `${MOODLE_BASE_URL}/mod/quiz/view.php?id=${quizId}`;
              Linking.openURL(quizUrl);
            }}
            style={styles.bg4a90e2_px6_py3_roundedxl_mb3}
          >
            <Text style={styles.textwhite_fontbold}>Ouvrir dans le navigateur</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setError(null);
              setIsLoading(true);
              webViewRef.current?.reload();
            }}
            style={styles.px6_py3_mb2}
          >
            <Text style={styles.textgray500_fontmedium}>Réessayer</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={styles.px6_py3}
          >
            <Text style={styles.textgray500}>Retour au cours</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex1_bgFAF9F6}>
      {/* Header */}
      <View style={styles.flexrow_itemscenter_justifybet}>
        <Pressable onPress={handleBack} style={styles.p2_ml2}>
          <Feather name="arrow-left" size={24} color="#374151" />
        </Pressable>
        <Text style={styles.textlg_fontbold_text002366}>
          {quizState === 'finished' ? 'Résultats' : 'Quiz'}
        </Text>
        <View style={styles.w10} />
      </View>
      
      {/* Progress indicator */}
      {quizState === 'inprogress' && (
        <View style={styles.h1_bggray200}>
 <View style={[styles.hfull_bg58CC02, { width: '50%' }]} />
        </View>
      )}
      
      {/* WebView */}
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={source ?? { uri: getQuizUrl() }}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={() => {
          setIsLoading(true);
          if (IS_DEV) console.log('[QuizWebView] Load started');
        }}
        onLoadEnd={() => {
          // Only set loading false if we're not already showing the quiz
          // This prevents flickering during SSO redirects
          if (quizState === 'loading') {
            setIsLoading(false);
          }
          if (IS_DEV) console.log('[QuizWebView] Load ended, current state:', quizState);
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
        // Security - allow mixed content for compatibility
        mixedContentMode="compatibility"
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
