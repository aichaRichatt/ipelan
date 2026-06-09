 // ─────────────────────────────────────────────────────────────────────────────
// Lecteur EPUB — connecté au serveur EpubPlugin (Node.js)
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
import { useLocalSearchParams, useRouter } from 'expo-router';
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
      // 1. Mettre en cache la section suivante si pas déjà présente
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

      // 2. Télécharger l'audio de la section courante pour offline
      if (!cancelled && currentSection?.audioFiles?.length) {
        await downloadAudioForSection(bookId, currentSection.audioFiles, getAudioUrl);
      }
    })();

    return () => { cancelled = true; };
  }, [currentSectionIndex, manifest, cmid, token]);

  // ── Sections audio : données injectées dans le JS de la WebView ──
  // Scopé à la section COURANTE uniquement (mode section-par-section) :
  //   • Le WebView ne contient qu'une section → 1 audio max dans le DOM
  //   • Payload JS minimal = chargement plus rapide + moins de mémoire
  // Une entrée par fichier audio pour couvrir les pages multi-audio (p11.1, p11.2…)
  const audioSections = (currentSection?.audioFiles ?? []).map(af => ({
    id      : currentSection?.id ?? '',
    audioUrl: getAudioUrl(af),
    timings : currentSection?.wordTimings?.[af] ?? [],
  }));

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
    .ipelan-word.current { background: #F59E0B; color: #fff !important; }
    .ipelan-word.done    { opacity: 0.55; }
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

      // Mots à garder visibles mais JAMAIS surlignés :
      // • chiffres seuls (numéros de page)
      // • "IPELAN", "Écoutez"
      // • codes de leçon : L1-W1, L2-W3, L10-W12…
      var _REMOVE_RE     = /^(\\d+|ipelan|[eé]coutez|L\\d+-W\\d+)$/i;
      var _PUNCT_ONLY_RE = /^[?!\\-\\u2013\\u2014:,;.«»]+$/;

      var fileToUrl        = {}; // "10.opus"   → URL complète serveur
      var fileToManifestId = {}; // "11.1.opus" → "p11"
      var fileToTimings    = {}; // "10.opus"   → [{word,start,end}] ou []
      for (var _i = 0; _i < AUDIO_SECTIONS.length; _i++) {
        var _s = AUDIO_SECTIONS[_i];
        if (_s.audioUrl) {
          var _fFull = (_s.audioUrl.split('/').pop() || '');
          var _f = _fFull.split('?')[0]; // strip ?token=... query string
          fileToUrl[_f]     = _s.audioUrl;
          fileToTimings[_f] = _s.timings || [];
          if (_s.id) fileToManifestId[_f] = _s.id;
        }
      }

      // ── 3. État ──
      var currentAudio    = null;
      var audioElByTrack  = {};
      var trackByManifest = {};
      var trackByFile     = {};
      var _trackCounter   = 0;

      // ── 4. Wrap text nodes in-place dans un élément DOM ──
      // Remplace chaque nœud texte par des <span class="ipelan-word"> pour chaque mot.
      // Ne crée AUCUN élément conteneur — le style EPUB original est entièrement préservé.
      function wrapTextNodes(el, wordSpans) {
        if (!el || el.dataset.ipelanWrapped) return;
        el.dataset.ipelanWrapped = '1';

        // Collecter les nœuds texte EN PREMIER (on ne modifie pas le DOM pendant le walk)
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var textNodes = [];
        var node;
        while ((node = walker.nextNode()) !== null) {
          if (!node.textContent.trim()) continue;
          // Ignorer les nœuds à l'intérieur de <audio>, <script>, <style>
          // et ceux déjà dans un span ipelan
          var p = node.parentElement;
          var skip = false;
          while (p && p !== el) {
            var tag = (p.tagName || '').toUpperCase();
            if (tag === 'AUDIO' || tag === 'SCRIPT' || tag === 'STYLE') { skip = true; break; }
            if (p.classList &&
                (p.classList.contains('ipelan-word') || p.classList.contains('ipelan-punct'))) {
              skip = true; break;
            }
            p = p.parentElement;
          }
          if (!skip) textNodes.push(node);
        }

        // Traiter chaque nœud texte
        for (var i = 0; i < textNodes.length; i++) {
          var tn = textNodes[i];
          if (!tn.parentNode) continue;
          var raw = tn.textContent;
          if (!raw.trim()) continue;

          // Découpe en tokens : mots ET espaces conservés pour recomposer le texte
          // Note : on traite même les nœuds à un seul mot (suppression du garde parts.length <= 1)
          var parts = raw.split(/(\\s+)/);

          // ── Détection nom de locuteur dans ce nœud texte ─────────────────
          // "Hammadi : Jam waali ?" → speakerIdx pointe sur "Hammadi"
          // Un locuteur = premier mot de lettres uniquement, pas ALL-CAPS, suivi de ":"
          var speakerIdx = -1;
          var firstWordIdx = -1;
          for (var _fi = 0; _fi < parts.length; _fi++) {
            if (!parts[_fi] || /^\\s+$/.test(parts[_fi])) continue;
            firstWordIdx = _fi; break;
          }
          if (firstWordIdx !== -1) {
            var fw = parts[firstWordIdx];
            var nextTok = '';
            for (var _ni = firstWordIdx + 1; _ni < parts.length; _ni++) {
              if (!parts[_ni] || /^\\s+$/.test(parts[_ni])) continue;
              nextTok = parts[_ni]; break;
            }
            if ((nextTok === ':' || nextTok === ':') &&
                /^[A-Za-z\\u00C0-\\u024F]+$/.test(fw) &&
                fw !== fw.toUpperCase()) {
              speakerIdx = firstWordIdx;
            }
          }
          // ─────────────────────────────────────────────────────────────────

          var frag = document.createDocumentFragment();
          var wrappedAny = false;
          for (var j = 0; j < parts.length; j++) {
            var part = parts[j];
            if (part === '') continue;
            // Conserver les espaces tels quels
            if (/^\\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
              continue;
            }
            // Nom de locuteur, mot filtré ou ponctuation seule → texte brut ou span non-hl
            if (j === speakerIdx || _REMOVE_RE.test(part)) {
              frag.appendChild(document.createTextNode(part));
              continue;
            }
            var span = document.createElement('span');
            span.textContent = part;
            if (_PUNCT_ONLY_RE.test(part)) {
              span.className = 'ipelan-punct';
            } else {
              span.className = 'ipelan-word';
              wordSpans.push(span);
              wrappedAny = true;
            }
            frag.appendChild(span);
          }
          // Remplacer le nœud texte par le fragment même si un seul mot wrappé
          if (wrappedAny) tn.parentNode.replaceChild(frag, tn);
        }
      }

      // ── 5. Éléments de texte d'un audio ───────────────────────────────────
      // Stratégie :
      //   1. Remonter jusqu'au wrapper de section (section, .page-container, body)
      //   2. Trouver l'enfant DIRECT de ce wrapper qui contient l'audio
      //   3. Collecter tous les siblings SUIVANTS jusqu'au prochain audio (ou fin)
      //
      // Pourquoi remonter jusqu'à la section et pas juste au <p> parent ?
      // Le EPUB peut avoir : <section> > <div.block> > <p>Écoutez <audio/></p>
      //                                             > <div>dialogue</div>
      //                      > <p>résumé</p>   ← sibling de div.block, PAS de <p>
      // En restant au niveau <p>, on rate le <p>résumé</p>.
      function getTextElsForAudio(audioEl) {
        // Remonter jusqu'à la section / page-container / body
        var section = audioEl.parentElement;
        while (section) {
          var tag = (section.tagName || '').toUpperCase();
          var cls = section.className || '';
          if (tag === 'SECTION' || tag === 'BODY' || tag === 'HTML') break;
          if (cls.indexOf('page-container') !== -1 || cls.indexOf('chapter-wrapper') !== -1) break;
          section = section.parentElement;
        }
        if (!section) return [];

        // Enfant direct de la section qui contient l'audio
        var audioBlock = audioEl;
        while (audioBlock.parentElement && audioBlock.parentElement !== section) {
          audioBlock = audioBlock.parentElement;
        }

        // Collecter tous les siblings de audioBlock jusqu'au prochain audio
        var result = [];
        var cur = audioBlock.nextElementSibling;
        while (cur) {
          if ((cur.tagName || '').toUpperCase() === 'AUDIO') break;
          if (cur.querySelector && cur.querySelector('audio')) break;
          result.push(cur);
          cur = cur.nextElementSibling;
        }
        return result;
      }

      // ── 8. Fixer la source audio et attacher les listeners ──
      function bindAudio(audioEl, trackId, wordSpans) {
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

        audioEl.ontimeupdate = function() {
          if (!wordSpans.length) return;
          var t = this.currentTime;
          var idx = -1;

          // Lookup dynamique à chaque tick : permet à __ipelanSetTimings()
          // de mettre à jour fileToTimings après que bindAudio() a été appelé.
          // (si capturé à la liaison, les mises à jour WhisperX n'auraient aucun effet)
          var _timings = fileToTimings[srcFile] || [];

          if (_timings.length > 0) {
            // ── Mode segments Whisper ─────────────────────────────────────
            // _timings = [{start, end}] — segments d'activité vocale détectés.
            // Whisper ne transcrit pas le Pulaar correctement mais détecte
            // précisément QUAND il y a de la parole (VAD).
            //
            // Algorithme :
            // 1. Trouver dans quel segment on est (t entre start et end)
            // 2. Calculer la progression DANS ce segment (0.0 → 1.0)
            // 3. Mapper : portion du segment → portion des wordSpans

            // Calculer la durée totale de parole (somme des durées de segments)
            var totalSpeech = 0;
            for (var _ts = 0; _ts < _timings.length; _ts++) {
              totalSpeech += Math.max(0, _timings[_ts].end - _timings[_ts].start);
            }
            if (totalSpeech <= 0) {
              // Fallback proportionnel si pas de segments
              if (!this.duration) return;
              idx = Math.min(Math.floor(t / this.duration * wordSpans.length), wordSpans.length - 1);
            } else {
              // Calculer combien de "temps de parole" s'est écoulé jusqu'à t
              var spokenSoFar = 0;
              var inSegment = false;
              for (var _ti = 0; _ti < _timings.length; _ti++) {
                var seg = _timings[_ti];
                if (t < seg.start) break; // pas encore arrivé
                if (t <= seg.end) {
                  // Dans ce segment — ajouter la portion de ce segment
                  spokenSoFar += (t - seg.start);
                  inSegment = true;
                  break;
                }
                // Segment entièrement passé
                spokenSoFar += (seg.end - seg.start);
              }
              if (!inSegment && t > (_timings[_timings.length - 1] || {}).end) {
                spokenSoFar = totalSpeech; // après le dernier segment
              }
              var progress = Math.min(spokenSoFar / totalSpeech, 1);
              idx = Math.min(Math.floor(progress * wordSpans.length), wordSpans.length - 1);
            }
          } else {
            // ── Mode proportionnel simple (Whisper non activé) ───────────
            if (!this.duration) return;
            idx = Math.min(Math.floor(t / this.duration * wordSpans.length), wordSpans.length - 1);
          }

          if (idx < 0 || idx === _lastIdx) return;
          _lastIdx = idx;
          for (var j = 0; j < wordSpans.length; j++) {
            wordSpans[j].classList.toggle('current', j === idx);
            wordSpans[j].classList.toggle('done',    j < idx);
          }
        };

        audioEl.onplay = function() {
          currentAudio = audioEl;
          // Mettre en pause tous les autres audios
          var allAudios = document.querySelectorAll('audio');
          for (var i = 0; i < allAudios.length; i++) {
            if (allAudios[i] !== audioEl && !allAudios[i].paused) allAudios[i].pause();
          }
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'audioStarted', sectionId: trackId })
          );
        };

        audioEl.onpause = function() {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'audioPaused', sectionId: trackId })
          );
        };

        audioEl.onended = function() {
          for (var j = 0; j < wordSpans.length; j++) {
            wordSpans[j].classList.remove('current');
            wordSpans[j].classList.add('done');
          }
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'audioEnded', sectionId: trackId })
          );
          setTimeout(function() {
            for (var k = 0; k < wordSpans.length; k++) {
              wordSpans[k].classList.remove('current', 'done');
            }
            _lastIdx = -1;
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

      // ── 9. Setup principal : un audio à la fois, sans logique de section ──
      function setupAudio() {
        var allAudios = document.querySelectorAll('audio');
        if (!allAudios.length) return;

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

          // Éléments de texte : siblings qui suivent l'audio jusqu'au prochain audio
          var textEls = getTextElsForAudio(audioEl);
          var wordSpans = [];
          for (var ti = 0; ti < textEls.length; ti++) {
            wrapTextNodes(textEls[ti], wordSpans);
          }

          bindAudio(audioEl, trackId, wordSpans);
        }
      }

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
      setTimeout(() => {
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
    }
  }, [currentSectionIndex, webviewReady]);

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
          <Text style={styles.headerTitle} numberOfLines={1}>
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
