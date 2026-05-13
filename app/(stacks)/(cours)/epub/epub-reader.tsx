// app/(stacks)/(cours)/epub/epub-reader.tsx
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
import { EpubReadingSection } from '../../../../services/epub/epubServerService';

const IS_DEV = process.env.NODE_ENV === 'development';

export default function EpubReaderScreen() {
  const router = useRouter();
  const { cmid, epubUrl, title } = useLocalSearchParams<{ cmid?: string; epubUrl?: string; title?: string }>();

  const webviewRef = useRef<WebView>(null);
  const [showToc, setShowToc] = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);

  // État audio piloté par les messages de la WebView
  const [webviewPlaying, setWebviewPlaying]               = useState(false);
  const [webviewActiveSectionId, setWebviewActiveSectionId] = useState<string | null>(null);

  // Flag pour auto-play après avance automatique de section
  const autoPlayNextRef = useRef(false);

  // Refs stables pour l'auto-advance (évite les stale closures dans handleWebViewMessage)
  const hasNextSectionRef = useRef(false);
  const nextSectionRef    = useRef<() => void>(() => {});

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
    mainHtmlUrl,
    getAudioUrl,
    refetch,
    serverUrl,
  } = useEpubReader(cmid ?? null, epubUrl ?? null);

  // Maintenir les refs synchronisées
  useEffect(() => { hasNextSectionRef.current = hasNextSection; }, [hasNextSection]);
  useEffect(() => { nextSectionRef.current    = nextSection;    }, [nextSection]);

  // ── Sections audio : {id, text, audioUrl} — embarquées dans l'injectedJavaScript ──
  // Même approche que test-reader.html : on utilise section.text du manifest,
  // pas le DOM de l'EPUB (dont la structure interne est imprévisible).
  // Une entrée par fichier audio (pas par section) pour que fileToUrl couvre
  // TOUS les fichiers — ex: p11 a 11.1.opus ET 11.2.opus dans le même manifest.
  const audioSections = (manifest?.readingSections ?? [])
    .filter(s => s.audioFiles.length > 0)
    .flatMap(s => s.audioFiles.map(af => ({
      id      : s.id,
      text    : s.text,
      audioUrl: getAudioUrl(af),
    })));

  // ── CSS injecté ──
  // Principe : ne PAS écraser les styles de l'EPUB original.
  // Les fichiers CSS du livre (Style1-3.css) sont chargés normalement par la WebView.
  // On ajoute seulement :
  //   • padding-bottom pour le footer de navigation
  //   • audio visible + taille raisonnable dans son conteneur flex
  //   • styles exclusifs aux word-tracks (éléments ajoutés par notre JS)
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

    /* Word-tracks — éléments INSÉRÉS après le <p> contenant l'audio.
       Background léger pour les distinguer visuellement du texte EPUB. */
    .ipelan-word-track {
      padding: 8px 6px 10px 6px;
      line-height: 2;
      font-size: 15px;
      font-family: Arial, sans-serif;
      background: rgba(255,255,255,0.6);
      border-radius: 6px;
      margin: 4px 0 10px 0;
    }
    .ipelan-word {
      display: inline;
      border-radius: 3px;
      padding: 0 1px;
      transition: background 0.08s, color 0.08s;
    }
    .ipelan-word.current { background: #F59E0B; color: #fff; }
    .ipelan-word.done    { color: #a06000; }
  `;

  // ── JS injecté dans la WebView ──
  // Architecture : contrôles audio NATIFS visibles + word-track dessous.
  // On attache ontimeupdate directement sur l'élément <audio> DOM
  // (pas de new Audio() séparé — le navigateur WebView déclenche ontimeupdate
  //  nativement quand l'utilisateur joue via les contrôles intégrés).
  const injectedJavaScript = `
    (function() {
      // ── 1. CSS ──
      var style = document.createElement('style');
      style.textContent = ${JSON.stringify(injectedCSS)};
      document.head.appendChild(style);

      // ── 2. Manifest : filename → {audioUrl, manifestId} ──
      var AUDIO_SECTIONS = ${JSON.stringify(audioSections)};
      var fileToUrl        = {}; // "10.opus"  → URL complète serveur
      var fileToManifestId = {}; // "11.1.opus" → "p11"
      for (var _i = 0; _i < AUDIO_SECTIONS.length; _i++) {
        var _s = AUDIO_SECTIONS[_i];
        if (_s.audioUrl) {
          var _f = _s.audioUrl.split('/').pop();
          fileToUrl[_f]        = _s.audioUrl;
          if (_s.id) fileToManifestId[_f] = _s.id;
        }
      }

      // ── 3. État ──
      var currentAudio    = null; // élément <audio> DOM actif
      var currentTrackId  = null;
      var audioElByTrack  = {};   // trackId → audioEl DOM
      var trackByManifest = {};   // manifestId → trackId (premier audio)
      var trackByFile     = {};   // "10.opus"  → trackId

      // ── 4. Helpers ──
      function resetTrack(track) {
        if (!track) return;
        track._lastIdx = -1;
        var ws = track.querySelectorAll('.ipelan-word');
        for (var k = 0; k < ws.length; k++) ws[k].classList.remove('current', 'done');
      }

      function resetAllTracks() {
        var all = document.querySelectorAll('.ipelan-word-track');
        for (var i = 0; i < all.length; i++) resetTrack(all[i]);
        currentTrackId = null;
      }

      // Texte propre d'un élément parent (sans audio/script/style/word-track)
      function extractText(el) {
        if (!el) return '';
        var clone = el.cloneNode(true);
        var rm = clone.querySelectorAll('audio,script,style,.ipelan-word-track,.footer-bar,.nav-bar');
        for (var i = 0; i < rm.length; i++) {
          if (rm[i].parentNode) rm[i].parentNode.removeChild(rm[i]);
        }
        return (clone.textContent || '').replace(/\\s+/g, ' ').trim();
      }

      // ── 5. Attacher listeners sur un élément <audio> natif ──
      // C'est ici que réside toute la logique de highlight :
      // ontimeupdate est déclenché par le browser à ~4-15 Hz pendant la lecture,
      // exactement comme dans test-reader.html.
      function bindNativeAudio(audioEl, trackId, wordSpans, track) {
        // Mettre à jour la src avec l'URL complète du serveur
        var srcFile = '';
        var src = audioEl.querySelector('source');
        if (src) srcFile = (src.getAttribute('src') || '').split('/').pop();
        var fullUrl = fileToUrl[srcFile];
        if (fullUrl) {
          audioEl.src = fullUrl;
          audioEl.load(); // nécessaire pour que le navigateur recharge avec la nouvelle src
        }

        audioEl.ontimeupdate = function() {
          if (!this.duration || !wordSpans.length) return;
          var pct = this.currentTime / this.duration;
          var idx = Math.min(Math.floor(pct * wordSpans.length), wordSpans.length - 1);
          if (track._lastIdx === idx) return;
          track._lastIdx = idx;
          // Réinitialiser les autres word-tracks (une seule lecture à la fois)
          var others = document.querySelectorAll('.ipelan-word-track');
          for (var i = 0; i < others.length; i++) {
            if (others[i] !== track) resetTrack(others[i]);
          }
          for (var j = 0; j < wordSpans.length; j++) {
            wordSpans[j].classList.toggle('current', j === idx);
            wordSpans[j].classList.toggle('done',    j < idx);
          }
        };

        audioEl.onplay = function() {
          currentAudio   = audioEl;
          currentTrackId = trackId;
          // Mettre en pause les autres audios
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
          setTimeout(function() { resetTrack(track); }, 600);
        };
      }

      // ── 6. Setup : parcourt les <audio> du DOM, crée word-tracks ──
      function setupAudio() {
        var allAudios = document.querySelectorAll('audio');
        for (var idx = 0; idx < allAudios.length; idx++) {
          var audioEl = allAudios[idx];
          if (audioEl.dataset.ipelanSetup) continue;
          audioEl.dataset.ipelanSetup = '1';

          var sourceEl = audioEl.querySelector('source');
          if (!sourceEl) continue;
          var srcFile = (sourceEl.getAttribute('src') || '').split('/').pop();
          if (!fileToUrl[srcFile]) continue; // pas dans le manifest

          // Texte de la <section> parente (chaque L1-W a son propre <section>)
          var parent = audioEl.parentElement;
          while (parent && parent.tagName !== 'SECTION' &&
                 !(parent.classList && (
                     parent.classList.contains('chapter-wrapper') ||
                     parent.classList.contains('page-container')
                   ))) {
            parent = parent.parentElement;
          }
          var text = extractText(parent || audioEl.parentElement);
          if (!text) {
            // Fallback manifest
            for (var mi = 0; mi < AUDIO_SECTIONS.length; mi++) {
              if ((AUDIO_SECTIONS[mi].audioUrl || '').split('/').pop() === srcFile) {
                text = AUDIO_SECTIONS[mi].text || '';
                break;
              }
            }
          }
          if (!text) continue;

          var trackId = 'ipelan-' + idx;
          audioElByTrack[trackId]  = audioEl;
          trackByFile[srcFile]     = trackId;
          var mId = fileToManifestId[srcFile];
          if (mId && !trackByManifest[mId]) trackByManifest[mId] = trackId;

          // Construire le word-track
          var wordSpans = [];
          var track = document.createElement('div');
          track.className = 'ipelan-word-track';
          track.setAttribute('data-track', trackId);
          track._lastIdx = -1;

          var words = text.trim().split(/\\s+/).filter(Boolean);
          for (var wi = 0; wi < words.length; wi++) {
            var span = document.createElement('span');
            span.className = 'ipelan-word';
            span.textContent = words[wi];
            wordSpans.push(span);
            track.appendChild(span);
            track.appendChild(document.createTextNode(' '));
          }

          // Les <audio> de ce livre sont DANS un <p style="display:flex">.
          // On insère le word-track APRÈS ce <p>, pas à l'intérieur,
          // pour ne pas casser la mise en page flex du paragraphe.
          var insertAfterEl = audioEl;
          var pParent = audioEl.parentNode;
          if (pParent && pParent.tagName &&
              ['P', 'SPAN', 'A', 'LABEL'].indexOf(pParent.tagName.toUpperCase()) !== -1) {
            insertAfterEl = pParent; // remonter au <p> pour insérer après lui
          }
          if (insertAfterEl.nextSibling) {
            insertAfterEl.parentNode.insertBefore(track, insertAfterEl.nextSibling);
          } else {
            insertAfterEl.parentNode.appendChild(track);
          }

          // Attacher les listeners sur le <audio> natif
          bindNativeAudio(audioEl, trackId, wordSpans, track);
        }
      }

      // ── 7. API publique (appelée par React Native via injectJavaScript) ──

      // Cache des wrappers de page (calculé une seule fois après le chargement)
      var _pageWrappers = null;
      function getPageWrappers() {
        if (!_pageWrappers) {
          _pageWrappers = Array.prototype.slice.call(
            document.querySelectorAll('.chapter-wrapper, .page-container')
          ).filter(function(el) {
            // Garder uniquement les wrappers de premier niveau (pas imbriqués)
            var p = el.parentElement;
            while (p) {
              if (p.classList && (p.classList.contains('chapter-wrapper') || p.classList.contains('page-container'))) return false;
              p = p.parentElement;
            }
            return true;
          });
        }
        return _pageWrappers;
      }

      // Navigation TOC principale : scroll par index de manifest (fiable pour TOUTES les sections)
      window.__ipelanScrollToIndex = function(n) {
        var wrappers = getPageWrappers();
        if (wrappers[n]) {
          wrappers[n].scrollIntoView(true);
          window.scrollBy(0, -8); // petit offset pour ne pas coller en haut
        }
      };

      // Navigation par id (secondaire, si l'id existe)
      window.__ipelanSetSection = function(sectionId) {
        if (!sectionId) return;
        var el = document.getElementById(sectionId);
        if (el) { el.scrollIntoView(true); window.scrollBy(0, -8); }
      };

      // Navigation pour sections sans id (tertiaire)
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

      // Bouton header RN : basculer play/pause sur l'audio actif
      window.__ipelanPlayPause = function() {
        if (!currentAudio) return;
        if (currentAudio.paused) currentAudio.play().catch(function(){});
        else currentAudio.pause();
      };

      // Démarrer le premier audio d'une section (auto-advance)
      window.__ipelanPlaySection = function(sectionId) {
        var tid = trackByManifest[sectionId];
        if (!tid) return;
        var el = audioElByTrack[tid];
        if (el) { el.currentTime = 0; el.play().catch(function(){}); }
      };

      // Pour sections sans manifest id
      window.__ipelanPlayByAudioFile = function(audioFileName) {
        var tid = trackByFile[audioFileName];
        if (!tid) return;
        var el = audioElByTrack[tid];
        if (el) { el.currentTime = 0; el.play().catch(function(){}); }
      };

      // ── 8. Init ──
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
        // Auto-avance : passer à la section suivante et la jouer automatiquement
        if (hasNextSectionRef.current) {
          autoPlayNextRef.current = true;
          nextSectionRef.current();
        }

      } else if (data.type === 'audioError') {
        if (IS_DEV) console.warn('[EpubReader] Audio error in WebView for section:', data.sectionId);
        setWebviewPlaying(false);
        setWebviewActiveSectionId(null);
      }
    } catch {}
  }, []); // deps vides — utilise des refs pour accéder aux valeurs courantes

  // ── Scroll vers la section active quand elle change ──
  // Utilise __ipelanScrollToIndex (index positionnel) comme méthode principale :
  // fiable pour TOUTES les sections, avec ou sans id DOM.
  useEffect(() => {
    if (!currentSection || !webviewReady) return;

    // Scroll positionnel — fonctionne pour toutes les sections
    webviewRef.current?.injectJavaScript(
      `window.__ipelanScrollToIndex && window.__ipelanScrollToIndex(${currentSectionIndex}); true;`
    );

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
    // Injecter le scroll directement après la fermeture du modal (animation ~300ms)
    // Le useEffect le fait aussi, mais ce setTimeout garantit l'ordre
    if (webviewReady) {
      setTimeout(() => {
        webviewRef.current?.injectJavaScript(
          `window.__ipelanScrollToIndex && window.__ipelanScrollToIndex(${index}); true;`
        );
      }, 320);
    }
  }, [goToSection, webviewReady]);

  // ── Loading ──
  if (isLoading) {
    const message =
      loadingState === 'checking_server' ? 'Connexion au serveur...' :
      loadingState === 'processing'      ? 'Traitement de l\'EPUB sur le serveur...' :
                                           'Chargement du livre...';
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#002366" />
        <Text style={styles.loadingText}>{message}</Text>
        <Text style={styles.loadingSubText}>{serverUrl}</Text>
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

      {/* WebView — charge le XHTML depuis le serveur EpubPlugin */}
      <View style={styles.webviewContainer}>
        {mainHtmlUrl ? (
          <WebView
            ref={webviewRef}
            source={{ uri: mainHtmlUrl }}
            style={styles.webview}
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
            }}
          />
        ) : (
          <View style={styles.centered}>
            <Text style={styles.loadingText}>Fichier introuvable</Text>
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
                      {item.hasAudio && (
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
});
