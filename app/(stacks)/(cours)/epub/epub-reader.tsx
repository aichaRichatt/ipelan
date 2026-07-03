 // ─────────────────────────────────────────────────────────────────────────────
// Lecteur EPUB Plugin
//
// Architecture (identique à test-reader.html) :
//   1. Fetch manifest depuis le serveur → readingSections [{id, text, audioFiles}]
//   2. WebView charge le XHTML depuis le serveur (URL directe)
//   3. Le JS injecté crée des boutons "Écouter" et des word-tracks depuis manifest.text
//   4. Audio joué par new Audio() DANS la WebView → ontimeupdate → highlight direct
//   5. React Native reçoit des postMessages pour sync état (audioStarted/Paused/Ended)
//   6. Navigation page par page : inject __ipelanSetSection → scrollIntoView + stop audio
// ─────────────────────────────────────────────────────────────────────────────

import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useEpubReader } from '../../../../hooks/useEpubReader';
import { useUserStats } from '../../../../hooks/useUserStats';
import {
  fetchSectionHtmlMoodle,
} from '../../../../services/epub/epubDownloadService';
import {
  cacheSectionOffline,
  downloadAudioForSection,
  getSectionOffline,
} from '../../../../services/epub/epubOfflineService';
import {
  buildBookId,
  EpubReadingSection,
  EpubWordTiming,
  fetchAlignment,
} from '../../../../services/epub/epubServerService';
import { HighlightSegment } from '../../../../services/epub/epubDownloadService';
import { syncAfterActivity } from '../../../../services/sync/progressSync';

const IS_DEV = process.env.NODE_ENV === 'development';

export default function EpubReaderScreen() {
  const router = useRouter();
  const { cmid, courseId: courseIdParam, epubUrl, title } = useLocalSearchParams<{
    cmid?: string; courseId?: string; epubUrl?: string; title?: string;
  }>();
  const courseId = courseIdParam ? Number(courseIdParam) : 0;

  const { addXP, addCoins } = useUserStats();

  const webviewRef = useRef<WebView>(null);
  const [showToc, setShowToc]           = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);
  const [webviewError, setWebviewError] = useState<string | null>(null);
  const [debugWordCount, setDebugWordCount] = useState<number | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const debugTapCount = useRef(0);
  const completionFiredRef              = useRef(false);

  // État audio piloté par les messages de la WebView
  const [webviewPlaying, setWebviewPlaying]               = useState(false);
  const [webviewActiveSectionId, setWebviewActiveSectionId] = useState<string | null>(null);

  // Flag pour auto-play après avance automatique de section
  const autoPlayNextRef = useRef(false);

  // Timings d'alignement par fichier audio.
  // Map<filename, timings> : [] = sentinel "en cours", non-empty = timings prêts.
  // Permet de ré-injecter les timings quand l'utilisateur revisite une section.
  const alignedTimingsRef = useRef<Map<string, EpubWordTiming[]>>(new Map());

  // Refs stables pour l'auto-advance (évite les stale closures dans handleWebViewMessage)
  const hasNextSectionRef = useRef(false);
  const nextSectionRef    = useRef<() => void>(() => {});

  // Compteur de secondes — actif pendant le chargement (feedback visuel)
  const [loadingSecs, setLoadingSecs] = useState(0);

  const {
    isLoading,
    loadingState,
    error,
    manifest,
    title: epubTitle,
    totalSections,
    currentSectionIndex,
    currentSection,
    goToSection,
    nextSection,
    previousSection,
    hasNextSection,
    hasPreviousSection,
    currentSectionHtml,
    isSectionLoading,
    fileBaseUrl,
    getAudioUrl,
    token,
    refetch,
    sectionSegments,
  } = useEpubReader(cmid ?? null, epubUrl ?? null);

  // Maintenir les refs synchronisées
  useEffect(() => { hasNextSectionRef.current = hasNextSection; }, [hasNextSection]);
  useEffect(() => { nextSectionRef.current    = nextSection;    }, [nextSection]);

   useEffect(() => {
    setWebviewReady(false);
  }, [currentSectionIndex]);

   useEffect(() => {
    if (!manifest || !cmid || !token) return;
    const bookId  = buildBookId(cmid);
    const cmidNum = Number(cmid);
    const nextIdx = currentSectionIndex + 1;
    const sections = manifest.readingSections;
    if (nextIdx >= sections.length) return;

    const nextSec = sections[nextIdx];
    if (!nextSec) return;

    let cancelled = false;

    (async () => {
      //  Mettre en cache la section suivante si pas déjà présente
      const cached = await getSectionOffline(bookId, nextIdx);
      if (!cancelled && !cached?.htmlPage) {
        try {
          const { html, sectionId, audioFiles } = await fetchSectionHtmlMoodle(
            cmidNum, nextIdx, token, true
          );
          if (!cancelled && html) {
            await cacheSectionOffline(
              bookId, nextIdx, sectionId, audioFiles, nextSec.text ?? '', html
            );
          }
        } catch {}
      }

      //  Télécharger l'audio de la section courante pour offline
      if (!cancelled && currentSection?.audioFiles?.length) {
        await downloadAudioForSection(bookId, currentSection.audioFiles, getAudioUrl);
      }
    })();

    return () => { cancelled = true; };
  }, [currentSectionIndex, manifest, cmid, token]);


  const audioSections = (currentSection?.audioFiles ?? []).map(af => ({
    id      : currentSection?.id ?? '',
    audioUrl: getAudioUrl(af),
    timings : currentSection?.wordTimings?.[af] ?? [],
  }));

  // Segments desktop par section (JSON uploadé depuis SYNCBOOK Studio)
  const sectionSegmentsForJS: Record<string, Array<{start: number; end: number; wordStart: number; wordEnd: number; text: string}>> = {};
  for (const [secId, segs] of Object.entries(sectionSegments)) {
    sectionSegmentsForJS[secId] = segs.map(s => ({
      start: s.start,
      end: s.end,
      wordStart: s.wordStart,
      wordEnd: s.wordEnd,
      text: s.text,
    }));
  }
  // Cross-reference segments desktop → manifest.
  // Le desktop sélectionne les sections via querySelectorAll('[id]') tandis que
  // le serveur utilise div[class*="page"]. Ces sélecteurs différents donnent
  // des indices de section différents (ex: "section-9" sur desktop vs "section-7"
  // sur serveur pour la même page).
  //
  // Solution: ignorer les IDs, matcher par NUMÉRO DE FICHIER AUDIO.
  // Pour chaque section desktop (ex: "section-9-0"), on essaie de trouver
  // une section manifest dont le fichier audio a le bon numéro de page.
  if (manifest?.readingSections) {
    // Index: tout fichier audio du manifest → info section
    const afIndex: Array<{ name: string; num: number; sub: string }> = [];
    for (const mSec of manifest.readingSections) {
      for (const af of mSec.audioFiles) {
        const name = af.split('/').pop()?.split('?')[0] || '';
        const num = parseInt(name, 10);
        const sub = name.match(/\.(\d+)\./)?.[1] ?? '';
        if (name && !isNaN(num)) afIndex.push({ name, num, sub });
      }
    }
    // Pour chaque groupe de segments desktop, trouver le fichier audio qui matche
    for (const [dId, segs] of Object.entries(sectionSegments)) {
      const dNum = parseInt(dId.match(/\d+/)?.[0] || '0', 10);
      if (isNaN(dNum)) continue;
      const dSub = dId.match(/-(\d+)$/)?.[1] ?? '';
      // Essayer dNum, dNum+1, dNum-1 comme numéro de page possible
      for (const pageNum of [dNum, dNum + 1, dNum - 1]) {
        if (pageNum <= 0) continue;
        let matched = false;
        for (const entry of afIndex) {
          if (entry.num !== pageNum) continue;
          // Le sub "0" du desktop correspond au fichier sans sub-audio
          const subMatch = (dSub === '0' && entry.sub === '') || (dSub !== '0' && dSub === entry.sub);
          if (!subMatch) continue;
          const mapped = segs.map(s => ({
            start: s.start, end: s.end,
            wordStart: s.wordStart, wordEnd: s.wordEnd,
            text: s.text,
          }));
          if (!sectionSegmentsForJS[entry.name]) sectionSegmentsForJS[entry.name] = mapped;
          if (IS_DEV) console.log(`[EpubReader] Matched "${dId}" → audio ${entry.name} (page ${pageNum})`);
          matched = true;
          break;
        }
        if (matched) break;
      }
    }
  }

  // ── CSS injecté ──
  // Principe : ne PAS écraser les styles de l'EPUB original.
  // Les fichiers CSS du livre (Style1-3.css) sont chargés normalement par la WebView.
  // On ajoute seulement :
  //   • padding-bottom pour le footer de navigation
  //   • audio visible + taille raisonnable dans son conteneur flex
  //   • styles pour le highlight en place dans le texte EPUB original (pas de nouvel élément)
  const injectedCSS = `
    body { padding-bottom: 120px !important; }

    /* Les <audio> dans ce livre sont TOUJOURS dans un <p style="display:flex">.
       On les laisse se comporter comme des flex-items (flex:1) pour partager
       la ligne avec "Écoutez :" sans écraser la mise en page originale. */
    audio {
      display: block !important;
      flex: 1 1 auto !important;
      min-width: 280px !important;
      height: 100px !important;
      margin: 4px 0 4px 6px !important;
      box-sizing: border-box !important;
    }

    /* Highlight en place : on entoure les mots EXISTANTS du DOM EPUB,
       sans créer de nouvel élément de contenu. */
    .ipelan-word {
      display: inline;
      border-radius: 2px;
      padding: 0 1px;
      transition: background 0.08s, color 0.08s;
    }
    .ipelan-word.current   { background: #3B82F6; color: #fff !important; }
    .ipelan-word.hl-playing { background: rgba(59, 130, 246, 0.2); }
    .ipelan-word.done       { background: rgba(0,0,0,0.06); }
    /* Ponctuation : visible, jamais surlignée */
    .ipelan-punct { display: inline; }
  `;

  // ── JS injecté dans la WebView ──
  // Architecture : contrôles audio NATIFS visibles.
  // On attache ontimeupdate directement sur l'élément <audio> DOM.
  // Le highlight se fait EN PLACE dans le texte EPUB original
  // (pas de nouveau div créé — on entoure seulement les mots existants avec des <span>).
  const injectedJavaScript = `
    (function() {
      // ── 0. Filet de sécurité : s'assurer que aucun audio ne précharge ──────
      // Le vrai blocage du préchargement est fait par injectedJavaScriptBeforeContentLoaded
      // (MutationObserver qui intercepte chaque <audio> au moment de son parsing).
      // Ce bloc est un filet pour les éléments qui auraient échappé à l'observer.
      (function() {
        var _ra = document.querySelectorAll('audio');
        for (var _ri = 0; _ri < _ra.length; _ri++) {
          _ra[_ri].preload = 'none';
          _ra[_ri].removeAttribute('autoplay');
          // PAS de load() ici — évite les requêtes réseau simultanées
        }
      })();

      // ── 1. CSS ──
      var style = document.createElement('style');
      style.textContent = ${JSON.stringify(injectedCSS)};
      document.head.appendChild(style);

      // ── 2. Manifest data ──
      var AUDIO_SECTIONS = ${JSON.stringify(audioSections)};
      window.__IPELAN_SEGMENTS = ${JSON.stringify(sectionSegmentsForJS)};
      var SEGMENTS_BY_SECTION = window.__IPELAN_SEGMENTS;

      // ── Gating silence (détection live, voir bindAudio/Web Audio API) ──
      // Valeurs de départ raisonnables, NON calibrées sur de vrais enregistrements —
      // à ajuster après test sur les 3 langues (niveaux d'enregistrement variables).
      var _SILENCE_RMS_THRESHOLD = 0.02;  // RMS normalisé 0–1 ; en dessous = silence
      var _SILENCE_HOLDOFF_MS    = 220;   // durée de silence continu avant de figer
      var _SPEECH_HOLDOFF_MS     = 80;    // durée de parole continue avant de reprendre

      var fileToUrl        = {}; // "10.opus"   → URL complète serveur
      var fileToManifestId = {}; // "11.1.opus" → "p11"
      var fileToTimings    = {}; // "10.opus"   → [{word,start,end}] ou []
      var fileToSegments   = {}; // "11.1.opus" → [{start,end,wordStart,wordEnd}]
      for (var _i = 0; _i < AUDIO_SECTIONS.length; _i++) {
        var _s = AUDIO_SECTIONS[_i];
        if (_s.audioUrl) {
          var _fFull = (_s.audioUrl.split('/').pop() || '');
          var _f = _fFull.split('?')[0]; // strip ?token=... query string
          fileToUrl[_f]     = _s.audioUrl;
          fileToTimings[_f] = _s.timings || [];
          if (_s.id) fileToManifestId[_f] = _s.id;
          // Segments : essayer section ID puis filename
          var _segData = (_s.id && SEGMENTS_BY_SECTION[_s.id]) || SEGMENTS_BY_SECTION[_f];
          if (_segData) {
            fileToSegments[_f] = _segData;
          }
        }
      }
      // Fallback initial : même logique que __ipelanSetSegments
      (function() {
        var _found0 = Object.keys(fileToSegments).length;
        if (_found0 < AUDIO_SECTIONS.length) {
          function _matchNum(idStr) {
            var m = (idStr || '').match(/(\d+(?:\.\d+)?)(?:-(\d+))?$/);
            return m ? m[1] + '|' + (m[2] || '') : null;
          }
          var _segByNum = {};
          for (var _sk in SEGMENTS_BY_SECTION) {
            var _nk = _matchNum(_sk);
            if (_nk) _segByNum[_nk] = SEGMENTS_BY_SECTION[_sk];
          }
          for (var _fi = 0; _fi < AUDIO_SECTIONS.length; _fi++) {
            var _as = AUDIO_SECTIONS[_fi];
            if (!_as.audioUrl) continue;
            var _af = _as.audioUrl.split('/').pop().split('?')[0];
            if (fileToSegments[_af]) continue;
            var _mk = _matchNum(_as.id);
            if (_mk && _segByNum[_mk]) {
              fileToSegments[_af] = _segByNum[_mk];
            }
          }
        }
      })();

      // ── 3. État ──
      var currentAudio    = null;
      var audioElByTrack  = {};
      var trackByManifest = {};
      var trackByFile     = {};
      var _trackCounter   = 0;

      // Ratio temps-de-parole/durée observé par fichier (EMA), pour estimer
      // la durée totale de parole en mode proportionnel sans VAD précomputé.
      // "10.opus" → ratio observé entre 0 et 1.
      var _fileSpeechRatio = {};

      // Durée réelle observée pour les fichiers en streaming (Infinity).
      // Stockée depuis onended → réutilisée dès la lecture suivante du même
      // fichier pour un highlight proportionnel précis.
      var _fileDuration = {};

      // AudioContext partagé (lazy) pour le gating silence — un seul par page,
      // réutilisé par chaque <audio> via createMediaElementSource.
      var _sharedAudioCtx = null;
      function _getAudioCtx() {
        if (_sharedAudioCtx) return _sharedAudioCtx;
        try {
          var Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return null;
          _sharedAudioCtx = new Ctx();
        } catch (e) { _sharedAudioCtx = null; }
        return _sharedAudioCtx;
      }

      // ── 4. Wrap text nodes in-place dans un élément DOM ──
      // Remplace chaque nœud texte par des <span class="ipelan-word"> pour chaque mot.
      // Ne crée AUCUN élément conteneur — le style EPUB original est entièrement préservé.
      //
      // IMPORTANT : les classes filtrées et la ponctuation isolée DOIVENT correspondre
      // exactement à ce que fait le desktop dans prepareHtmlForHighlight() et extractText(),
      // sinon les indices wordStart/wordEnd des segments JSON ne correspondent pas.
      var _MOBILE_SKIP_CLASSES = /illustration|caption|figcaption|label|no-highlight|decorative|nav-bar|footer-bar|sgc-nav|bottom-text/i;
      var _MOBILE_AUDIO_LABEL_RE = /^(écoutez|écouter|audio|listen|play|replay)[\s:;!]*$/i;
      var _MOBILE_PUNCT_RE = /^[?.!,:;—–-]+$/;
      function wrapTextNodes(el, wordSpans) {
        if (!el || el.dataset.ipelanWrapped) return;
        el.dataset.ipelanWrapped = '1';

        // Collecter les nœuds texte EN PREMIER (on ne modifie pas le DOM pendant le walk)
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var textNodes = [];
        var node;
        while ((node = walker.nextNode()) !== null) {
          if (!node.textContent.trim()) continue;
          var p = node.parentElement;
          var skip = false;
          while (p && p !== el) {
            var tag = (p.tagName || '').toUpperCase();
            if (tag === 'AUDIO' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'VIDEO' || tag === 'FIGURE' || tag === 'FIGCAPTION') { skip = true; break; }
            if (p.classList &&
                (p.classList.contains('ipelan-word') || p.classList.contains('ipelan-punct'))) {
              skip = true; break;
            }
            // Filtrer les classes que le desktop exclut (label, decorative, etc.)
            if (p.className && _MOBILE_SKIP_CLASSES.test(p.className)) { skip = true; break; }
            // Filtrer les éléments masqués (role="presentation", aria-hidden)
            if (p.getAttribute && (p.getAttribute('role') === 'presentation' || p.getAttribute('aria-hidden') === 'true')) { skip = true; break; }
            p = p.parentElement;
          }
          // Filtrer les labels audio (Écoutez :, écouter, listen, etc.)
          if (!skip && _MOBILE_AUDIO_LABEL_RE.test(node.textContent.trim())) skip = true;
          if (!skip) textNodes.push(node);
        }

        // Traiter chaque nœud texte
        for (var i = 0; i < textNodes.length; i++) {
          var tn = textNodes[i];
          if (!tn.parentNode) continue;
          var raw = tn.textContent;
          if (!raw.trim()) continue;

          var parts = raw.split(/(\\s+)/);

          var frag = document.createDocumentFragment();
          var wrappedAny = false;
          for (var j = 0; j < parts.length; j++) {
            var part = parts[j];
            if (part === '') continue;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
              continue;
            }
            // Ponctuation isolée → span .ipelan-punct, PAS dans wordSpans
            if (_MOBILE_PUNCT_RE.test(part)) {
              var punctSpan = document.createElement('span');
              punctSpan.textContent = part;
              punctSpan.className = 'ipelan-punct';
              frag.appendChild(punctSpan);
              continue;
            }
            var span = document.createElement('span');
            span.textContent = part;
            span.className = 'ipelan-word';
            wordSpans.push(span);
            wrappedAny = true;
            frag.appendChild(span);
          }
          if (wrappedAny) tn.parentNode.replaceChild(frag, tn);
        }
      }

      // ── 4bis. Pondération des mots par longueur de caractères ─────────────
      // Un mot de 10 lettres prend plus de temps à prononcer qu'un mot de 2 —
      // remplace la répartition uniforme (1 mot = 1 fraction égale de temps)
      // par une répartition proportionnelle à la longueur. cumWeights[i] est
      // la borne supérieure normalisée (0..1) du mot i ; cumWeights[n-1] === 1.
      function buildCumulativeWeights(wordSpans) {
        var n = wordSpans.length;
        var weights = new Array(n);
        var total = 0;
        for (var i = 0; i < n; i++) {
          weights[i] = Math.max(1, (wordSpans[i].textContent || '').length);
          total += weights[i];
        }
        var cum = new Array(n);
        var acc = 0;
        for (var j = 0; j < n; j++) {
          acc += weights[j];
          cum[j] = acc / total;
        }
        return cum;
      }

      // Recherche binaire : index du mot dont l'intervalle [cum[i-1], cum[i]]
      // contient progress (0..1).
      function indexFromProgress(cumWeights, progress) {
        var lo = 0, hi = cumWeights.length - 1;
        while (lo < hi) {
          var mid = (lo + hi) >> 1;
          if (cumWeights[mid] < progress) lo = mid + 1; else hi = mid;
        }
        return lo;
      }

      // ── 5. getTextElsForAudio — SUPPRIMÉ ───────────────────────────────────
      // Cette fonction collectait les éléments de texte autour de chaque audio.
      // Remplacée par le body-wide wrap dans setupAudio (section 9) pour que
      // tous les audios partagent le même wordSpans couvrant le texte complet
      // de la section. Voir #9 pour la justification.

      // ── 8. Fixer la source audio et attacher les listeners ──
      function bindAudio(audioEl, trackId, wordSpans, cumWeights) {
        audioEl.dataset.trackId = trackId;

        // Mise à jour de la source : on écrit le bon URL du serveur dans <source src>.
        // L'étape 0 a déjà annulé les éventuels fetch des mauvais chemins relatifs.
        // Aucun nouveau fetch ne démarre ici (preload="none") — il aura lieu au play().
        var srcEl = audioEl.querySelector('source');
        var srcFile = srcEl ? (srcEl.getAttribute('src') || '').split('/').pop() : '';
        if (!srcFile) srcFile = (audioEl.getAttribute('src') || '').split('/').pop();
        var fullUrl = fileToUrl[srcFile];
        if (fullUrl) {
          if (srcEl) {
            srcEl.setAttribute('src', fullUrl);
          } else {
            audioEl.src = fullUrl;
          }
          // preload="none" was set by the MutationObserver to block requests on the
          // wrong relative URL. Now that the correct authenticated URL is in place:
          // • preload="metadata" → fetches only the first few KB to get duration
          //   (fixes controls always showing 0:00)
          // • load() → acknowledges the source change without downloading the file
          //   (fixes controls flickering/disappearing on first tap because without
          //   it the browser triggers an implicit load() on the first user interaction)
          audioEl.preload = 'metadata';
          audioEl.load();
        }

        var _lastIdx = -1;
        var _lastSegIdx = -1;
        var _lastSegStateKey = null;

        // Durée de repli pour le streaming mobile où duration = Infinity.
        // Mise à jour à chaque ontimeupdate avec le max de currentTime observé.
        var _maxStreamTime = 0;

        // ── Gating silence (Web Audio API) ──
        // Détection live de silence/parole, indépendante de la langue (pas de
        // transcription) — gèle le mode proportionnel pendant les pauses.
        // Défensif : si la Web Audio API échoue, _isSpeaking reste true et le
        // comportement est identique à avant ce correctif (pas de régression).
        var _isSpeaking       = true;
        var _silenceTimerStart = null;
        var _speechTimerStart  = null;
        var _analyser  = null;
        var _sampleBuf = null;
        var _rafId     = null;

        // ── Horloge de temps de parole effectif (mode proportionnel) ──
        // Voir ontimeupdate : _speechElapsed n'avance que pendant la parole,
        // ce qui évite le saut en avant au retour d'un silence.
        var _speechElapsed  = 0;
        var _lastTickTime   = null;
        var _speechRatioEMA = _fileSpeechRatio[srcFile] || 1.0;

        // ── Calibration adaptative du seuil de silence (par fichier) ──
        var _calibSamples    = [];
        var _calibDeadlineMs = null;
        var _CALIB_WINDOW_MS = 400;
        var _localThreshold  = _SILENCE_RMS_THRESHOLD;

        // ── Anti-flicker (throttle des mises à jour DOM) ──
        var _lastDomUpdateMs = null;

        (function setupSilenceGate() {
          try {
            var ctx = _getAudioCtx();
            if (!ctx) return;
            var source = ctx.createMediaElementSource(audioEl);
            var analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            analyser.connect(ctx.destination); // CRITIQUE : sinon plus aucun son
            _analyser  = analyser;
            _sampleBuf = new Uint8Array(analyser.frequencyBinCount);
          } catch (e) { _analyser = null; }
        })();

        function _sampleAmplitude() {
          if (!_analyser || !_sampleBuf) return null;
          _analyser.getByteTimeDomainData(_sampleBuf);
          var sumSq = 0;
          for (var _si = 0; _si < _sampleBuf.length; _si++) {
            var d = _sampleBuf[_si] - 128;
            sumSq += d * d;
          }
          return Math.sqrt(sumSq / _sampleBuf.length) / 128;
        }

        function _silenceGateTick() {
          if (audioEl.paused || audioEl.ended) { _rafId = null; return; }
          var rms = _sampleAmplitude();
          if (rms !== null) {
            var now = Date.now();

            // ── Phase de calibration (bruit de fond de CET enregistrement,
            // mesuré sur les premières _CALIB_WINDOW_MS de chaque lecture) ──
            if (_calibDeadlineMs !== null) {
              _calibSamples.push(rms);
              if (now >= _calibDeadlineMs) {
                if (_calibSamples.length >= 5) {
                  _calibSamples.sort(function(a, b) { return a - b; });
                  var noiseFloor = _calibSamples[Math.floor(_calibSamples.length * 0.05)];
                  // Plafond appliqué au RÉSULTAT final (pas à un seul terme) :
                  // si l'audio démarre directement sur de la parole (pas de
                  // silence initial), noiseFloor est mesuré pendant la parole
                  // et peut être élevé — sans ce plafond, noiseFloor*2.5 peut
                  // dépasser 0.05 et classer toute la suite comme silence,
                  // gelant le highlight quasi immédiatement après la calibration.
                  _localThreshold = Math.min(Math.max(noiseFloor * 2.5, 0.008), 0.05);
                }
                _calibDeadlineMs = null;
              }
              // Pendant la calibration : ne pas geler le mot (comportement "parole" par défaut)
              _rafId = requestAnimationFrame(_silenceGateTick);
              return;
            }

            if (rms < _localThreshold) {
              _speechTimerStart = null;
              if (_silenceTimerStart === null) _silenceTimerStart = now;
              if (_isSpeaking && (now - _silenceTimerStart) >= _SILENCE_HOLDOFF_MS) _isSpeaking = false;
            } else {
              _silenceTimerStart = null;
              if (_speechTimerStart === null) _speechTimerStart = now;
              if (!_isSpeaking && (now - _speechTimerStart) >= _SPEECH_HOLDOFF_MS) _isSpeaking = true;
            }
          }
          _rafId = requestAnimationFrame(_silenceGateTick);
        }

        audioEl.ontimeupdate = function() {
          if (!wordSpans.length) return;
          var t = this.currentTime;
          var idx = -1;

          // Lookup dynamique à chaque tick : permet à __ipelanSetTimings()
          // de mettre à jour fileToTimings après que bindAudio() a été appelé.
          var _timings  = fileToTimings[srcFile]  || [];
          var _segments = fileToSegments[srcFile] || [];

          if (_segments.length > 0) {
            // ── Mode 1 : segments JSON (priorité exclusive) ─────────────────
            // Les plages de mots (_ws, _we) sont précalculées par _computeWordRanges()
            // d'après le texte de chaque segment. Les wordStart/wordEnd du desktop
            // sont ignorés (indices desktop ≠ mobile).
            //
            //   hl-playing : mots de _ws à idxInSeg (phrase en cours)
            //   current    : mot exact à la position courante

            var currentSeg = null;
            var _activeSegIdx = -1;
            for (var _si = 0; _si < _segments.length; _si++) {
              var _seg = _segments[_si];
              if (t >= _seg.start && t <= _seg.end) { currentSeg = _seg; _activeSegIdx = _si; break; }
            }

            var _lastSegIdxLocal = _segments.length - 1;

            // ── Après le dernier segment → geler sur le dernier mot ──
            if (!currentSeg && t > _segments[_lastSegIdxLocal].end) {
              if (_lastIdx < 0) {
                _lastIdx = wordSpans.length - 1;
                _lastSegIdx = -1;
              }
              return;
            }

            // ── Entre deux segments → geler l'état actuel (silence) ──
            if (!currentSeg && _lastSegIdx >= 0) {
              return;
            }

            // ── Avant le premier segment → aucun highlight ──
            if (!currentSeg) {
              for (var _clr = 0; _clr < wordSpans.length; _clr++) {
                wordSpans[_clr].classList.remove('current', 'hl-playing');
              }
              _lastIdx = -1;
              _lastSegIdx = -1;
              _lastDomUpdateMs = null;
              return;
            }

            // Anti-flicker (changement de segment)
            if (_activeSegIdx !== _lastSegIdx) {
              _lastIdx = -1;
              _lastSegIdx = _activeSegIdx;
              _lastDomUpdateMs = null;
            }

            // ── Position dans la phrase ──
            var idxInSeg = -1;
            var _phraseStart = -1;
            if (currentSeg && currentSeg._ws >= 0 && currentSeg._we >= currentSeg._ws) {
              var segDuration = Math.max(currentSeg.end - currentSeg.start, 0.001);
              var segProgress = Math.min(Math.max((t - currentSeg.start) / segDuration, 0), 1);
              var spanCount  = currentSeg._we - currentSeg._ws;
              idxInSeg = Math.round(currentSeg._ws + segProgress * spanCount);
              if (idxInSeg > currentSeg._we) idxInSeg = currentSeg._we;
              if (idxInSeg >= wordSpans.length) idxInSeg = wordSpans.length - 1;
              _phraseStart = currentSeg._ws;
            } else if (currentSeg) {
              // Fallback : time-proportionnel si le text matching a echoue
              var _totalTime = 0;
              for (var _si2 = 0; _si2 < _segments.length; _si2++) {
                _totalTime += Math.max(0.001, _segments[_si2].end - _segments[_si2].start);
              }
              var _elapsed = 0;
              for (var _si2 = 0; _si2 < _activeSegIdx; _si2++) {
                _elapsed += Math.max(0, _segments[_si2].end - _segments[_si2].start);
              }
              _elapsed += Math.max(0, t - currentSeg.start);
              var progress = Math.min(Math.max(_elapsed / _totalTime, 0), 1);
              idxInSeg = indexFromProgress(cumWeights, progress);
              if (idxInSeg >= wordSpans.length) idxInSeg = wordSpans.length - 1;
              // Phrase approx : debut du segment proportionnel
              var _elapsedBefore = 0;
              for (var _si2 = 0; _si2 < _activeSegIdx; _si2++) {
                _elapsedBefore += Math.max(0, _segments[_si2].end - _segments[_si2].start);
              }
              _phraseStart = indexFromProgress(cumWeights, Math.min(Math.max(_elapsedBefore / _totalTime, 0), 1));
            }

            // Anti-flicker
            if (idxInSeg >= 0 && idxInSeg < _lastIdx) idxInSeg = _lastIdx;
            if (idxInSeg >= 0 && idxInSeg === _lastIdx) return;
            var _nowMs = Date.now();
            if (_lastDomUpdateMs !== null && (_nowMs - _lastDomUpdateMs) < 40) return;
            _lastDomUpdateMs = _nowMs;
            if (idxInSeg >= 0) _lastIdx = idxInSeg;

            for (var j = 0; j < wordSpans.length; j++) {
              var inPhrase = (_phraseStart >= 0 && j >= _phraseStart && j <= idxInSeg);
              if (inPhrase) {
                wordSpans[j].classList.toggle('current', j === idxInSeg && idxInSeg >= 0);
                wordSpans[j].classList.toggle('hl-playing', j !== idxInSeg);
                wordSpans[j].classList.remove('done');
              } else {
                wordSpans[j].classList.remove('current', 'hl-playing', 'done');
              }
            }
            return;
          }

          // ── Mode 2/3 désactivé — highlight UNIQUEMENT via les segments JSON ──
          // Le code des modes 2 (Whisper VAD) et 3 (proportionnel) ci-dessous
          // est conservé dans la fonction mais N'EST JAMAIS ATTEINT.
          return;

          if (idx < 0) {
            if (_timings.length > 0) {
              // ── Mode 2 : segments Whisper VAD ────────────────────────────
              // _timings = [{start, end}] — segments d'activité vocale.

              var totalSpeech = 0;
              for (var _ts = 0; _ts < _timings.length; _ts++) {
                totalSpeech += Math.max(0, _timings[_ts].end - _timings[_ts].start);
              }
              if (totalSpeech <= 0) {
                if (!this.duration) return;
                idx = indexFromProgress(cumWeights, t / this.duration);
              } else {
                var spokenSoFar = 0;
                var inSegment = false;
                for (var _ti = 0; _ti < _timings.length; _ti++) {
                  var seg = _timings[_ti];
                  if (t < seg.start) break;
                  if (t <= seg.end) {
                    spokenSoFar += (t - seg.start);
                    inSegment = true;
                    break;
                  }
                  spokenSoFar += (seg.end - seg.start);
                }
                if (!inSegment && t > (_timings[_timings.length - 1] || {}).end) {
                  spokenSoFar = totalSpeech;
                }
                var progress = Math.min(spokenSoFar / totalSpeech, 1);
                idx = indexFromProgress(cumWeights, progress);
              }
            } else {
              // ── Mode 3 : proportionnel simple ────────────────────────────
              // PAS de blocage silence (_isSpeaking) — AnalyserNode Web Audio
              // = 0 RMS sur mobile (contexte suspendu). _speechElapsed avance
              // sans condition.
              var _dur = this.duration;
              if (!_dur || !isFinite(_dur)) {
                if (t > _maxStreamTime) _maxStreamTime = t;
                _dur = _fileDuration[srcFile] || 90;
              }
              if (_dur <= 0) return;

              var _dt = (_lastTickTime === null) ? 0 : (t - _lastTickTime);
              _lastTickTime = t;
              if (_dt < 0 || _dt > 1.5) _dt = 0;

              _speechElapsed += _dt;

              var _estTotalSpeech = _dur * _speechRatioEMA;
              var _spProgress = Math.min(_speechElapsed / Math.max(_estTotalSpeech, 0.001), 1);
              idx = indexFromProgress(cumWeights, _spProgress);
            }
          }

          // ── Anti-flicker : jamais de retour en arrière, throttle DOM ~25fps ──
          if (idx < _lastIdx) idx = _lastIdx;
          if (idx < 0 || idx === _lastIdx) return;
          var _nowMs = Date.now();
          if (_lastDomUpdateMs !== null && (_nowMs - _lastDomUpdateMs) < 40) return;
          _lastDomUpdateMs = _nowMs;

          _lastIdx = idx;
          for (var j = 0; j < wordSpans.length; j++) {
            wordSpans[j].classList.toggle('current', j === idx);
            wordSpans[j].classList.toggle('done',    j < idx);
          }
        };

        audioEl.onplay = function() {
          currentAudio = audioEl;
          _lastIdx = -1;
          _lastSegIdx = -1;
          _lastSegStateKey = null;
          _lastDomUpdateMs = null;
          // Mettre en pause tous les autres audios
          var allAudios = document.querySelectorAll('audio');
          for (var i = 0; i < allAudios.length; i++) {
            if (allAudios[i] !== audioEl && !allAudios[i].paused) allAudios[i].pause();
          }
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'audioStarted', sectionId: trackId })
          );

          // Gating silence : reset propre à chaque lecture + reprise du contexte
          // audio s'il était suspendu (politique autoplay) + (re)démarrage de la
          // boucle d'échantillonnage.
          _isSpeaking = true;
          _silenceTimerStart = null;
          _speechTimerStart  = null;

          // Reset de l'horloge de temps de parole + nouvelle fenêtre de calibration
          // du seuil de silence pour CETTE lecture (bruit de fond propre au fichier).
          // Recharge aussi _speechRatioEMA : si l'utilisateur réécoute la même
          // section sans recharger la page, onended a pu mettre à jour
          // _fileSpeechRatio[srcFile] depuis la lecture précédente.
          _speechElapsed   = 0;
          _lastTickTime    = null;
          _speechRatioEMA  = _fileSpeechRatio[srcFile] || _speechRatioEMA;
          _calibSamples    = [];
          _calibDeadlineMs = Date.now() + _CALIB_WINDOW_MS;

          try {
            var _ctx = _getAudioCtx();
            if (_ctx && _ctx.state === 'suspended') _ctx.resume().catch(function(){});
          } catch (e) {}
          if (_analyser && _rafId === null) _rafId = requestAnimationFrame(_silenceGateTick);
        };

        audioEl.onpause = function() {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'audioPaused', sectionId: trackId })
          );
          if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
        };

        audioEl.onended = function() {
          if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }

          // Mémoriser le ratio temps-de-parole/durée observé sur cette lecture
          // (EMA par fichier) — affine l'estimation du mode proportionnel dès
          // la prochaine écoute du même fichier (fréquent : réécoute pédagogique).
          if (this.duration > 0 && _speechElapsed > 0) {
            var _observedRatio = Math.min(_speechElapsed / this.duration, 1);
            var _prevRatio = _fileSpeechRatio[srcFile];
            _fileSpeechRatio[srcFile] = (_prevRatio === undefined)
              ? _observedRatio
              : (0.3 * _observedRatio + 0.7 * _prevRatio);
          }

          // Pour le streaming mobile (duration = Infinity), mémoriser la durée
          // réelle observée (= max de currentTime atteint) pour le prochain
          // highlight proportionnel du même fichier.
          if (_maxStreamTime > 0 && !_fileDuration[srcFile]) {
            _fileDuration[srcFile] = _maxStreamTime;
          }

          for (var j = 0; j < wordSpans.length; j++) {
            wordSpans[j].classList.remove('current', 'hl-playing', 'done');
          }
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'audioEnded', sectionId: trackId })
          );
          setTimeout(function() {
            for (var k = 0; k < wordSpans.length; k++) {
              wordSpans[k].classList.remove('current', 'hl-playing', 'done');
            }
            _lastIdx = -1;
            _lastSegIdx = -1;
            _lastDomUpdateMs = null;
          }, 600);
        };

        audioEl.onerror = function() {
          // Ignorer les erreurs d'abandon (code 1 = MEDIA_ERR_ABORTED)
          // qui surviennent normalement lors du changement de source.
          if (this.error && this.error.code === 1) return;
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'audioError', sectionId: trackId })
          );
        };
      }

      // ── 9. Setup principal : wordSpans PARTAGÉ entre tous les audios ──
      // CRITIQUE : segments.wordStart/wordEnd sont relatifs au texte COMPLET
      // de la section, pas au texte autour d'un audio spécifique.
      // getTextElsForAudio() collectait par audio => sur pages multi-audio,
      // wordSpans ne couvrait qu'une partie → décalage d'index.
      // On wrappe maintenant tout le <body> une seule fois, tous les audios
      // partagent le même wordSpans.
      var _ipelanWordSpans = null;
      var _ipelanCumWeights = null;
      function setupAudio() {
        var allAudios = document.querySelectorAll('audio');
        if (!allAudios.length) return;

        // Wrapper tout le texte de la section UNE SEULE FOIS
        if (!_ipelanWordSpans) {
          _ipelanWordSpans = [];
          var pageRoot = document.body || document.documentElement;
          wrapTextNodes(pageRoot, _ipelanWordSpans);
          _ipelanCumWeights = buildCumulativeWeights(_ipelanWordSpans);

          // DEBUG
          if (_ipelanWordSpans.length > 0 && window.ReactNativeWebView) {
            var debugWords = [];
            for (var _dw = 0; _dw < Math.min(_ipelanWordSpans.length, 5); _dw++) {
              debugWords.push(_ipelanWordSpans[_dw].textContent);
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'debugWordSpans',
              wordCount: _ipelanWordSpans.length,
              srcFile: 'shared',
              firstWords: debugWords,
            }));
          }
        }

        var wordSpans = _ipelanWordSpans;
        var cumWeights = _ipelanCumWeights || [];

        for (var idx = 0; idx < allAudios.length; idx++) {
          var audioEl = allAudios[idx];
          if (audioEl.dataset.ipelanSetup) continue;

          var srcEl = audioEl.querySelector('source');
          var srcFile = srcEl ? (srcEl.getAttribute('src') || '').split('/').pop() : '';
          if (!srcFile) srcFile = (audioEl.getAttribute('src') || '').split('/').pop();
          if (!fileToUrl[srcFile]) continue;

          audioEl.dataset.ipelanSetup = '1';

          var trackId = 'ipelan-' + (_trackCounter++);
          audioElByTrack[trackId] = audioEl;
          trackByFile[srcFile]    = trackId;
          var mId = fileToManifestId[srcFile];
          if (mId && !trackByManifest[mId]) trackByManifest[mId] = trackId;

          bindAudio(audioEl, trackId, wordSpans, cumWeights);
        }
      }

      // ── 9bis. Debug : inspecter le highlight ──
      window.__debugHighlight = function() {
        var allSpans = document.querySelectorAll('.ipelan-word');
        var info = {
          totalAudio: document.querySelectorAll('audio').length,
          wordSpanCount: allSpans.length,
          currentWords: [],
          audioSections: typeof AUDIO_SECTIONS !== 'undefined' ? AUDIO_SECTIONS.length : 0,
        };
        for (var _dh = 0; _dh < Math.min(allSpans.length, 10); _dh++) {
          var _s = allSpans[_dh];
          info.currentWords.push((_s.textContent || '').substring(0, 20) + (_s.classList.contains('current') ? ' ←CURRENT' : '') + (_s.classList.contains('done') ? ' ←DONE' : ''));
        }
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debugHighlight', info: info }));
        }
        return JSON.stringify(info, null, 2);
      };

      // ── 10. Navigation API ──
      var _pageWrappers = null;
      function getPageWrappers() {
        if (!_pageWrappers) {
          var all = document.querySelectorAll('.chapter-wrapper, .page-container, .fixed-page, section');
          _pageWrappers = [];
          for (var i = 0; i < all.length; i++) {
            var el = all[i];
            var p = el.parentElement;
            var nested = false;
            while (p) {
              if (p.classList &&
                  (p.classList.contains('chapter-wrapper') || p.classList.contains('page-container') || p.classList.contains('fixed-page'))) {
                nested = true; break;
              }
              if (p.tagName && p.tagName.toUpperCase() === 'SECTION' && p !== el) {
                nested = true; break;
              }
              p = p.parentElement;
            }
            if (!nested) _pageWrappers.push(el);
          }
        }
        return _pageWrappers;
      }

      window.__ipelanScrollToIndex = function(n) {
        var wrappers = getPageWrappers();
        if (wrappers[n]) {
          wrappers[n].scrollIntoView(true);
          window.scrollBy(0, -8);
        }
      };

      window.__ipelanSetSection = function(sectionId) {
        if (!sectionId) return;
        var el = document.getElementById(sectionId);
        if (el) { el.scrollIntoView(true); window.scrollBy(0, -8); }
      };

      window.__ipelanScrollToAudio = function(audioFileName) {
        var allAudios = document.querySelectorAll('audio');
        for (var i = 0; i < allAudios.length; i++) {
          var src = allAudios[i].querySelector('source');
          if (src && (src.getAttribute('src') || '').split('/').pop() === audioFileName) {
            allAudios[i].scrollIntoView(true);
            window.scrollBy(0, -8);
            return;
          }
        }
      };

      window.__ipelanPlayPause = function() {
        if (!currentAudio) return;
        if (currentAudio.paused) currentAudio.play().catch(function(){});
        else currentAudio.pause();
      };

      // Verrou anti-double-play : le useEffect RN peut injecter __ipelanPlaySection
      // plusieurs fois en rafale (StrictMode double-mount, changements de state rapides).
      // Sans verrou, ipelan-3 + ipelan-5 + ipelan-4 démarrent simultanément et se
      // coupent mutuellement via onplay → pause des autres.
      var _playLock = false;
      function _withPlayLock(fn) {
        if (_playLock) return;
        _playLock = true;
        setTimeout(function() { _playLock = false; }, 800);
        fn();
      }

      window.__ipelanPlaySection = function(sectionId) {
        _withPlayLock(function() {
          var tid = trackByManifest[sectionId];
          if (!tid) return;
          var el = audioElByTrack[tid];
          if (el) { el.currentTime = 0; el.play().catch(function(){}); }
        });
      };

      window.__ipelanPlayByAudioFile = function(audioFileName) {
        _withPlayLock(function() {
          var tid = trackByFile[audioFileName];
          if (!tid) return;
          var el = audioElByTrack[tid];
          if (el) { el.currentTime = 0; el.play().catch(function(){}); }
        });
      };

      // ── 11. API d'alignement WhisperX ──
      // Appelée depuis RN via injectJavaScript() quand l'alignement d'un fichier
      // audio est disponible. Met à jour fileToTimings en temps réel :
      // le prochain ontimeupdate utilisera automatiquement les timestamps précis.
      window.__ipelanSetTimings = function(filename, timings) {
        fileToTimings[filename] = timings;
      };

      // ── Re-indexation des plages de mots par segment ──
      // Le desktop stocke wordStart/wordEnd (indices du desktop) qui ne
      // correspondent pas aux wordSpans du mobile. On recalcule ces plages
      // en CHERCHANT le TEXTE de chaque segment dans les wordSpans reels.
      // Approche: on concatene TOUS les wordSpans nettoyes en une seule
      // chaine, puis on y cherche le texte du segment (nettoye lui aussi).
      // Cela fonctionne meme si les limites de mots different (ex: segment
      // "ALKULAL AA" → 2 mots, mais wordSpans ["ALKULAL","A","A"] → 3 mots).
      function _cleanWord(t) {
        return (t || '').toLowerCase().replace(/[^a-z0-9\u00C0-\u02AF\u0300-\u036F\u0400-\u04FF]+/g, '');
      }
      function _computeWordRanges() {
        var wordEls = document.querySelectorAll('.ipelan-word');
        if (!wordEls.length) return;
        var wordCleans = [];
        for (var _wi = 0; _wi < wordEls.length; _wi++) {
          wordCleans.push(_cleanWord(wordEls[_wi].textContent || ''));
        }
        var allClean = wordCleans.join('');
        // Index: position caractere → index mot
        var charToWord = [];
        for (var _wi = 0; _wi < wordCleans.length; _wi++) {
          for (var _c = 0; _c < wordCleans[_wi].length; _c++) {
            charToWord.push(_wi);
          }
        }
        for (var _f in fileToSegments) {
          var segs = fileToSegments[_f];
          if (!segs || !segs.length) continue;
          for (var _si = 0; _si < segs.length; _si++) {
            var seg = segs[_si];
            if (!seg.text) { seg._ws = -1; seg._we = -1; continue; }
            var segClean = _cleanWord(seg.text);
            if (!segClean) { seg._ws = -1; seg._we = -1; continue; }
            var pos = allClean.indexOf(segClean);
            if (pos >= 0 && charToWord.length > 0) {
              var endPos = Math.min(pos + segClean.length - 1, charToWord.length - 1);
              seg._ws = charToWord[pos];
              seg._we = charToWord[endPos];
            } else {
              seg._ws = -1; seg._we = -1;
            }
          }
        }
      }

      // ── API segments JSON (desktop Word highlights) ──
      // Même principe que __ipelanSetTimings : la fonction capture
      // fileToSegments + AUDIO_SECTIONS par closure, donc même quand
      // les segments arrivent asynchronement de RN (re-injection),
      // on met à jour la variable dans la portée IIFE.
      function _matchNum(idStr) {
        var m = (idStr || '').match(/(\d+(?:\.\d+)?)(?:-(\d+))?$/);
        return m ? m[1] + '|' + (m[2] || '') : null;
      }
      window.__ipelanSetSegments = function(segmentsBySection) {
        window.__IPELAN_SEGMENTS = segmentsBySection;
        var _s, _f, _found = 0;
        for (var _i = 0; _i < AUDIO_SECTIONS.length; _i++) {
          _s = AUDIO_SECTIONS[_i];
          if (_s.audioUrl) {
            _f = _s.audioUrl.split('/').pop().split('?')[0];
            // Essayer par section ID puis par filename (Stratégie 2)
            var _segData = segmentsBySection[_s.id] || segmentsBySection[_f];
            if (_segData) {
              fileToSegments[_f] = _segData;
              _found++;
            }
          }
        }
        // Fallback par extraction numérique : IDs "section-9-0" → "9|0"
        if (_found < AUDIO_SECTIONS.length) {
          var _segByNum = {};
          for (var _sk in segmentsBySection) {
            var _nk = _matchNum(_sk);
            if (_nk) _segByNum[_nk] = segmentsBySection[_sk];
          }
          for (var _fi = 0; _fi < AUDIO_SECTIONS.length; _fi++) {
            _s = AUDIO_SECTIONS[_fi];
            if (!_s.audioUrl) continue;
            _f = _s.audioUrl.split('/').pop().split('?')[0];
            if (fileToSegments[_f]) continue;
            var _mk = _matchNum(_s.id);
            if (_mk && _segByNum[_mk]) {
              fileToSegments[_f] = _segByNum[_mk];
              _found++;
            }
          }
        }
        _computeWordRanges();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'debugState',
          state: { injected: true, matchedSectionIds: _found, audioSectionIds: AUDIO_SECTIONS.map(function(s){return s.id;}), segmentsKeys: Object.keys(segmentsBySection), ts: Date.now() }
        }));
      };
      window.__ipelanDebugState = function() {
        var _keys = Object.keys(fileToSegments);
        var _ids  = AUDIO_SECTIONS.map(function(s) { return s.id; });
        var _segKeys = Object.keys(window.__IPELAN_SEGMENTS || {});
        return { fileToSegmentsKeys: _keys, manifestIds: _ids, segmentsKeys: _segKeys, ts: Date.now() };
      };
      // Post initial state immediately on page load
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'debugState',
        state: { initial: true, fileToSegmentsKeys: Object.keys(fileToSegments), manifestIds: AUDIO_SECTIONS.map(function(s){return s.id;}), segmentsKeys: Object.keys(window.__IPELAN_SEGMENTS || {}) }
      }));

      // ── 12. Images/sources Moodle : ajouter token sur les URLs pluginfile ──
      // Le <base href> PHP résout les URLs relatives en webservice/pluginfile.php.
      // Le WebView n'a pas de cookie Moodle → toute URL pluginfile sans token est bloquée.
      // Cette fonction ajoute le token, en convertissant pluginfile→webservice si besoin
      // (compatibilité avec les manifests mis en cache avant la mise à jour du plugin).
      (function() {
        var _tok = ${JSON.stringify(token)};
        if (!_tok) return;
        function _addToken(url) {
          if (!url || url.indexOf('pluginfile.php/') === -1) return null;
          // Convertir pluginfile.php → webservice/pluginfile.php si besoin
          var u = url.indexOf('/webservice/pluginfile.php/') === -1
            ? url.replace('/pluginfile.php/', '/webservice/pluginfile.php/')
            : url;
          // Ajouter le token seulement s'il est absent
          if (u.indexOf('token=') !== -1) return null;
          return u + (u.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(_tok);
        }
        // <img src> (not deferred)
        var imgs = document.querySelectorAll('img[src]');
        for (var _ii = 0; _ii < imgs.length; _ii++) {
          var _patched = _addToken(imgs[_ii].src);
          if (_patched) imgs[_ii].src = _patched;
        }
        // Deferred images: src removed by injectedJavaScriptBeforeContentLoaded to avoid
        // broken-image flash. Restore now with token appended.
        var deferred = document.querySelectorAll('img[data-defer-src]');
        for (var _ddi = 0; _ddi < deferred.length; _ddi++) {
          var _deferUrl = deferred[_ddi].dataset.deferSrc || '';
          var _dPatched = _addToken(_deferUrl);
          if (_dPatched) deferred[_ddi].src = _dPatched;
          else if (_deferUrl) deferred[_ddi].src = _deferUrl;
        }
        // <picture><source srcset> (rare dans EPUB mais possible)
        var srcs = document.querySelectorAll('picture source[srcset]');
        for (var _si = 0; _si < srcs.length; _si++) {
          var _ss = (srcs[_si].getAttribute('srcset') || '').trim();
          var _firstUrl = _ss.split(/[\s,]/)[0];
          var _spPatched = _addToken(_firstUrl);
          if (_spPatched) srcs[_si].srcset = _spPatched;
        }
      })();

      // ── 13. Init ──
      setupAudio();
      // Re-indexer les plages de mots après la création des wordSpans
      _computeWordRanges();
      new MutationObserver(function() { setupAudio(); })
        .observe(document.documentElement, { childList: true, subtree: true });

      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'pageReady' })
      );
    })();
    true;
  `;

  // ── Gestion des messages de la WebView ──
  // Utilise des refs pour éviter les stale closures sur hasNextSection/nextSection
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (IS_DEV) console.log('[EpubReader] WebView msg:', data.type, data.sectionId ?? '');

      if (data.type === 'pageReady') {
        setWebviewReady(true);

      } else if (data.type === 'audioStarted') {
        setWebviewPlaying(true);
        setWebviewActiveSectionId(data.sectionId ?? null);

      } else if (data.type === 'audioPaused') {
        setWebviewPlaying(false);

      } else if (data.type === 'audioEnded') {
        setWebviewPlaying(false);
        setWebviewActiveSectionId(null);

        if (hasNextSectionRef.current) {
          // Auto-avance vers la section suivante
          autoPlayNextRef.current = true;
          nextSectionRef.current();
        } else if (!completionFiredRef.current) {
          // Dernière section — déclencher la completion une seule fois
          completionFiredRef.current = true;
          const cmidNum = cmid ? Number(cmid) : 0;
          if (cmidNum && courseId) {
            syncAfterActivity({ courseId, cmid: cmidNum, score: 100, maxScore: 100 });
          }
          addXP(30);
          addCoins(10);
        }

      } else if (data.type === 'audioError') {
        if (IS_DEV) console.warn('[EpubReader] Audio error in WebView for section:', data.sectionId);
        setWebviewPlaying(false);
        setWebviewActiveSectionId(null);

      } else if (data.type === 'debugWordSpans') {
        setDebugWordCount(data.wordCount);
        if (IS_DEV) console.log('[EpubReader] Debug wordSpans:', data);

      } else if (data.type === 'debugHighlightResult') {
        setDebugInfo(data.result);
        if (IS_DEV) console.log('[EpubReader] Debug highlight result:', data.result);

      } else if (data.type === 'debugState') {
        if (IS_DEV) console.log('[EpubReader] WebView state:', JSON.stringify(data.state));
      }
    } catch {}
  }, [cmid, courseId, addXP, addCoins]); // cmid/courseId/addXP/addCoins stables — refs pour le reste

  // ── Auto-play quand la WebView est prête après un changement de section ──
  // En mode section-par-section, le scroll est inutile (1 seule section dans le DOM).
  // On attend uniquement que la WebView ait posté pageReady pour démarrer l'audio.
  useEffect(() => {
    if (!currentSection || !webviewReady) return;

    if (autoPlayNextRef.current) {
      autoPlayNextRef.current = false;
      const sid            = currentSection.id ?? '';
      const firstAudioFile = (currentSection.audioFiles?.[0] ?? '').split('/').pop();
      // Délai pour laisser le scroll se terminer avant de lancer l'audio
      const timer = setTimeout(() => {
        if (sid) {
          webviewRef.current?.injectJavaScript(
            `window.__ipelanPlaySection && window.__ipelanPlaySection('${sid}'); true;`
          );
        } else if (firstAudioFile) {
          webviewRef.current?.injectJavaScript(
            `window.__ipelanPlayByAudioFile && window.__ipelanPlayByAudioFile('${firstAudioFile}'); true;`
          );
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentSectionIndex, webviewReady]);

  // ── Injecter les segments JSON dans la WebView ──
  // CRITIQUE : la WebView RELOAD complètement à chaque changement de section
  // (source={{ html }}). À chaque pageReady il faut ré-injecter les segments
  // dans la nouvelle IIFE — même si sectionSegmentsForJS n'a pas changé.
  // Sans ça, la nouvelle WebView ne reçoit jamais les segments.
  // On utilise __ipelanSetSegments (closure sur fileToSegments de l'IIFE) —
  // contrairement à du raw injectJavaScript qui s'exécute en scope global.
  const segmentsJson = JSON.stringify(sectionSegmentsForJS);
  useEffect(() => {
    if (!webviewReady) return;
    if (segmentsJson === '{}') return; // pas encore chargés
    const _segKeys = Object.keys(sectionSegmentsForJS);
    if (IS_DEV) console.log('[EpubReader] Injecting segments for sections:', _segKeys);
    webviewRef.current?.injectJavaScript(
      `window.__ipelanSetSegments(${segmentsJson}); true;`
    );
    if (IS_DEV) console.log('[EpubReader] Segments injected into WebView');
  }, [segmentsJson, webviewReady]);

  // ── Coupe l'audio dès que l'écran perd le focus ──
  // L'audio vit dans le DOM de la WebView (balises <audio>), pas dans un
  // player natif — démonter le composant ne suffit pas toujours à l'arrêter
  // immédiatement (session audio WebView qui peut survivre brièvement côté
  // natif). On le met en pause explicitement dès le blur, plus rapide et
  // plus fiable que d'attendre le démontage complet.
  useFocusEffect(
    useCallback(() => {
      return () => {
        webviewRef.current?.injectJavaScript(
          `document.querySelectorAll('audio').forEach(function(a){ a.pause(); }); true;`
        );
        setWebviewPlaying(false);
      };
    }, [])
  );

  // ── Alignement WhisperX en arrière-plan ──
  // Déclenché à chaque changement de section ET quand la WebView est prête.
  //
  // Logique Map :
  //   • undefined  → jamais traité → lancer l'alignement
  //   • [] (vide)  → sentinel "en cours" → ignorer (évite les appels dupliqués)
  //   • [timings…] → déjà aligné → ré-injecter dans la nouvelle page WebView
  //                  (nécessaire quand l'utilisateur revisite une section)
  useEffect(() => {
    if (!manifest || !webviewReady || !cmid) return;

    const bookIdStr = buildBookId(cmid);
    const langCode  = manifest.language === 'wolof'   ? 'wo'  :
                      manifest.language === 'pulaar'  ? 'ff'  :
                      manifest.language === 'soninke' ? 'snk' : 'fr';

    const toAlign = manifest.readingSections
      .slice(currentSectionIndex, currentSectionIndex + 3)
      .filter(s => s.audioFiles.length > 0 && (s.text || '').trim().length > 5);

    let cancelled = false;

    (async () => {
      for (const section of toAlign) {
        for (const af of section.audioFiles) {
          if (cancelled) return;

          const filename = af.split('/').pop() || '';
          if (!filename) continue;

          const cached = alignedTimingsRef.current.get(filename);

          if (cached !== undefined) {
            // Déjà en Map : ré-injecter si des timings sont disponibles
            if (cached.length > 0) {
              webviewRef.current?.injectJavaScript(
                `window.__ipelanSetTimings && window.__ipelanSetTimings(${JSON.stringify(filename)}, ${JSON.stringify(cached)}); true;`
              );
            }
            // Si [] (sentinel en cours) → une autre invocation s'en occupe déjà
            continue;
          }

          // Marquer "en cours" avant l'await
          alignedTimingsRef.current.set(filename, []);

          try {
            if (IS_DEV) console.log('[EpubReader] Aligning:', filename);
            const words = await fetchAlignment(bookIdStr, af, section.text || '', langCode);
            if (cancelled) return;

            if (words.length > 0) {
              if (IS_DEV) console.log('[EpubReader] Aligned:', filename, words.length, 'mots');
              alignedTimingsRef.current.set(filename, words);
              webviewRef.current?.injectJavaScript(
                `window.__ipelanSetTimings && window.__ipelanSetTimings(${JSON.stringify(filename)}, ${JSON.stringify(words)}); true;`
              );
            } else {
              // Aucun timing → supprimer le sentinel pour permettre un retry
              alignedTimingsRef.current.delete(filename);
            }
          } catch {
            alignedTimingsRef.current.delete(filename);
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [currentSectionIndex, webviewReady, manifest, cmid]);

  // ── Bouton play/pause dans le header ──
  const handlePlayPause = useCallback(() => {
    if (!webviewReady) return;
    if (webviewActiveSectionId) {
      // Audio en cours (ou en pause) → basculer
      webviewRef.current?.injectJavaScript(`window.__ipelanPlayPause && window.__ipelanPlayPause(); true;`);
    } else {
      // Pas encore de section active → démarrer le premier audio de la section courante
      const sid           = currentSection?.id ?? '';
      const firstAudioFile = (currentSection?.audioFiles?.[0] ?? '').split('/').pop();
      if (sid) {
        webviewRef.current?.injectJavaScript(
          `window.__ipelanPlaySection && window.__ipelanPlaySection('${sid}'); true;`
        );
      } else if (firstAudioFile) {
        webviewRef.current?.injectJavaScript(
          `window.__ipelanPlayByAudioFile && window.__ipelanPlayByAudioFile('${firstAudioFile}'); true;`
        );
      }
    }
  }, [webviewReady, webviewActiveSectionId, currentSection?.id, currentSection?.audioFiles]);

  // ── Navigation : reset état audio côté RN + appel hook ──
  const handleNextSection = useCallback(() => {
    setWebviewPlaying(false);
    setWebviewActiveSectionId(null);
    nextSection();
  }, [nextSection]);

  const handlePreviousSection = useCallback(() => {
    setWebviewPlaying(false);
    setWebviewActiveSectionId(null);
    previousSection();
  }, [previousSection]);

  const handleSectionSelect = useCallback((index: number) => {
    setWebviewPlaying(false);
    setWebviewActiveSectionId(null);
    goToSection(index);
    setShowToc(false);
    // Mode section-par-section : la WebView recharge automatiquement avec la nouvelle
    // URL de section → pas besoin d'injecter un scroll.
  }, [goToSection]);

  // ── Compteur de secondes pendant le chargement ──
  useEffect(() => {
    if (!isLoading) {
      setLoadingSecs(0);
      return;
    }
    setLoadingSecs(0);
    const id = setInterval(() => setLoadingSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  // ── Loading ──
  if (isLoading) {
    const isProcessing = loadingState === 'processing';
    const message =
      loadingState === 'checking_server' ? 'Connexion...' :
      isProcessing                       ? 'Veuillez patienter...' :
      loadingSecs >= 8                   ? 'Extraction du livre en cours...' :
                                           'Chargement du livre...';
    const subMessage = isProcessing || loadingSecs >= 8
      ? `Cette opération ne se fait qu'une seule fois${loadingSecs > 0 ? ` (${loadingSecs}s)` : ' (30-60 secondes)'}`
      : null;
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#002366" />
        <Text style={styles.loadingText}>{message}</Text>
        {subMessage && <Text style={[styles.loadingSubText, { marginTop: 8, color: '#6B7280' }]}>{subMessage}</Text>}
      </SafeAreaView>
    );
  }

  // ── Erreur ──
  if (error) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.headerTitle}>Erreur</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={refetch} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const displayTitle = title || epubTitle;
  const progress = totalSections > 0 ? ((currentSectionIndex + 1) / totalSections) * 100 : 0;
  const hasCurrentAudio = (currentSection?.audioFiles?.length ?? 0) > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}
            onPress={() => {
              debugTapCount.current++;
              if (debugTapCount.current >= 5) {
                debugTapCount.current = 0;
                webviewRef.current?.injectJavaScript(
                  'window.ReactNativeWebView.postMessage(JSON.stringify({type:"debugHighlightResult", result:__debugHighlight()})); true;'
                );
              }
            }}
          >
            {displayTitle}
          </Text>
          <Text style={styles.headerSub}>
            Page {currentSectionIndex + 1}/{totalSections}
            {manifest?.language ? ` · ${manifest.language}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => setShowToc(true)} style={styles.iconBtn}>
          <Feather name="menu" size={24} color="#002366" />
        </Pressable>
        {hasCurrentAudio && (
          <Pressable onPress={handlePlayPause} style={styles.iconBtn}>
            <Ionicons
              name={webviewPlaying ? 'pause-circle' : 'play-circle'}
              size={28}
              color="#002366"
            />
          </Pressable>
        )}
      </View>

      {/* Barre de progression */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {(debugWordCount !== null || debugInfo) && (
        <View style={{ position:'absolute', top: 100, right: 10, backgroundColor:'rgba(0,0,0,0.7)', padding: 6, borderRadius: 6, zIndex: 999 }}>
          {debugWordCount !== null && <Text style={{ color: '#fff', fontSize: 11 }}>Mots: {debugWordCount}</Text>}
          {debugInfo !== null && <Text style={{ color: '#ff0', fontSize: 9, maxWidth: 280 }}>{debugInfo}</Text>}
        </View>
      )}

      {/* WebView — charge la section courante via HTML inline (Moodle WS) */}
      <View style={styles.webviewContainer}>
        {isSectionLoading && !currentSectionHtml && (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#002366" />
          </View>
        )}
        {currentSectionHtml ? (
          <WebView
            ref={webviewRef}
            source={{ html: currentSectionHtml, baseUrl: fileBaseUrl }}
            style={styles.webview}
            onLoad={() => {}}
            injectedJavaScriptBeforeContentLoaded={`
              (function() {
                // S'exécute AVANT que le HTML soit parsé.
                // Intercepte chaque <audio> et <img> au moment de leur ajout au DOM.
                // • Audio  : bloque le préchargement (évite requêtes vers mauvaises URLs relatives)
                // • Images : diffère le chargement des images pluginfile (pas encore de token)
                //            → stocke l'URL résolue dans data-defer-src, vide src
                //            → section 12 de injectedJavaScript restaure avec le token
                new MutationObserver(function(mutations) {
                  for (var i = 0; i < mutations.length; i++) {
                    var nodes = mutations[i].addedNodes;
                    for (var j = 0; j < nodes.length; j++) {
                      var n = nodes[j];
                      if (!n || n.nodeType !== 1) continue;
                      // Audio
                      var audios = n.tagName === 'AUDIO' ? [n]
                                 : (n.querySelectorAll ? Array.prototype.slice.call(n.querySelectorAll('audio')) : []);
                      for (var k = 0; k < audios.length; k++) {
                        audios[k].preload = 'none';
                        audios[k].removeAttribute('autoplay');
                      }
                      // Images pluginfile — reporter le chargement jusqu'à ce que le token soit ajouté
                      var imgs = n.tagName === 'IMG' ? [n]
                               : (n.querySelectorAll ? Array.prototype.slice.call(n.querySelectorAll('img')) : []);
                      for (var m = 0; m < imgs.length; m++) {
                        var resolvedSrc = imgs[m].src || '';
                        if (resolvedSrc && resolvedSrc.indexOf('pluginfile.php/') !== -1 && resolvedSrc.indexOf('token=') === -1) {
                          imgs[m].dataset.deferSrc = resolvedSrc;
                          imgs[m].removeAttribute('src');
                        }
                      }
                    }
                  }
                }).observe(document, { childList: true, subtree: true });
              })();
              true;
            `}
            injectedJavaScript={injectedJavaScript}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            scrollEnabled={true}
            allowFileAccess={true}
            mixedContentMode="always"
            mediaPlaybackRequiresUserAction={false}
            onError={(e) => {
              if (IS_DEV) console.warn('[EpubReader] WebView error:', e.nativeEvent);
              setWebviewError('Impossible de charger le contenu du livre.');
            }}
          />
        ) : (
          <View style={styles.centered}>
            <Text style={styles.loadingText}>Fichier introuvable</Text>
          </View>
        )}
        {webviewError && (
          <View style={styles.webviewErrorOverlay}>
            <Ionicons name="alert-circle" size={36} color="#EF4444" />
            <Text style={styles.webviewErrorText}>{webviewError}</Text>
            <Pressable onPress={() => { setWebviewError(null); setWebviewReady(false); refetch(); }} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Footer navigation */}
      <View style={styles.footer}>
        <Pressable
          onPress={handlePreviousSection}
          disabled={!hasPreviousSection}
          style={[styles.navBtn, !hasPreviousSection && styles.navBtnDisabled]}
        >
          <Feather name="chevron-left" size={20} color={hasPreviousSection ? '#002366' : '#9CA3AF'} />
          <Text style={[styles.navBtnText, !hasPreviousSection && styles.navBtnTextDisabled]}>
            Préc.
          </Text>
        </Pressable>

        <Pressable onPress={() => setShowToc(true)} style={styles.pageIndicator}>
          <Text style={styles.pageIndicatorText}>
            {currentSectionIndex + 1} / {totalSections}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleNextSection}
          disabled={!hasNextSection}
          style={[styles.navBtnNext, !hasNextSection && styles.navBtnDisabled]}
        >
          <Text style={[styles.navBtnNextText, !hasNextSection && styles.navBtnTextDisabled]}>
            {hasNextSection ? 'Suiv.' : 'Fin'}
          </Text>
          <Feather name="chevron-right" size={20} color={hasNextSection ? '#FFFFFF' : '#9CA3AF'} />
        </Pressable>
      </View>

      {/* Modal Table des matières */}
      <Modal visible={showToc} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Table des matières</Text>
              <Pressable onPress={() => setShowToc(false)} style={styles.iconBtn}>
                <Feather name="x" size={24} color="#6B7280" />
              </Pressable>
            </View>
            <FlatList
              data={manifest?.readingSections || []}
              keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : String(index)}
              renderItem={({ item, index }: { item: EpubReadingSection; index: number }) => (
                <Pressable
                  onPress={() => handleSectionSelect(index)}
                  style={[
                    styles.tocItem,
                    index === currentSectionIndex && styles.tocItemActive,
                  ]}
                >
                  <View style={styles.tocItemLeft}>
                    <Text style={[
                      styles.tocItemNumber,
                      index === currentSectionIndex && styles.tocItemTextActive,
                    ]}>
                      {index + 1}.
                    </Text>
                    <View style={styles.tocItemContent}>
                      <Text style={[
                        styles.tocItemText,
                        index === currentSectionIndex && styles.tocItemTextActive,
                      ]} numberOfLines={2}>
                        {item.text.substring(0, 80) || `Page ${item.pageNumber ?? index + 1}`}
                      </Text>
                      {(item.audioFiles?.length ?? 0) > 0 && (
                        <Ionicons name="musical-notes" size={12} color="#4a90e2" style={styles.tocAudioIcon} />
                      )}
                    </View>
                  </View>
                  {index === currentSectionIndex && (
                    <Feather name="check" size={16} color="#002366" />
                  )}
                </Pressable>
              )}
              contentContainerStyle={styles.tocList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    padding: 8,
    marginRight: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  iconBtn: {
    padding: 8,
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#E5E7EB',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4a90e2',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 8,
    marginVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  navBtnNext: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#002366',
  },
  navBtnDisabled: {
    backgroundColor: '#F9FAFB',
    opacity: 0.5,
  },
  navBtnText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#002366',
  },
  navBtnNextText: {
    marginRight: 4,
    fontSize: 14,
    color: '#FFFFFF',
  },
  navBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pageIndicatorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#002366',
  },
  loadingText: {
    marginTop: 16,
    color: '#4B5563',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingSubText: {
    marginTop: 8,
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#002366',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  tocList: {
    paddingBottom: 40,
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tocItemActive: {
    backgroundColor: '#EFF6FF',
  },
  tocItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 8,
  },
  tocItemNumber: {
    width: 30,
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  tocItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tocItemText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  tocItemTextActive: {
    color: '#002366',
    fontWeight: '700',
  },
  tocAudioIcon: {
    marginLeft: 6,
  },
  webviewErrorOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webviewErrorText: {
    marginTop: 12,
    color: '#4B5563',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
});
