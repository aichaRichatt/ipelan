import { RootState } from "@/services/redux/store";
import { cleanAndAuthUrl } from "@/services/urlAuth";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

const IS_DEV = process.env.NODE_ENV === "development";

const styles = StyleSheet.create({
  bg002366_rounded2xl_py4_itemsc: {
    alignItems: 'center',
    backgroundColor: '#002366',
    borderRadius: 16,
    paddingVertical: 16
  },
  flex1: {
    flex: 1
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
  flex1_itemscenter_justifycente: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  flexrow_itemscenter_justifycen: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center'
  },
  flexrow_justifybetween: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  h2_bggray200_roundedfull_overf: {
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    height: 8,
    marginBottom: 8,
    overflow: 'hidden'
  },
  hfull_bg4a90e2_roundedfull: {
    backgroundColor: '#4a90e2',
    borderRadius: 9999,
    height: '100%'
  },
  mr4_p2: {
    marginRight: 16,
    padding: 8
  },
  mt4_textgray600: {
    color: '#4B5563',
    marginTop: 16
  },
  px5_py4: {
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
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    height: 56,
    justifyContent: 'center',
    width: 56
  },
  style_2: {
    color: '#6B7280',
    fontSize: 12
  },
  style_3: {
    color: '#6B7280',
    fontSize: 12
  },
  style_4: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  style_5: {
    marginRight: 16,
    padding: 8
  },
  style_6: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  style_7: {
    backgroundColor: '#FAF9F6',
    flex: 1
  },
  textgray500_mt4_textcenter: {
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center'
  },
  textgray500_textxs: {
    color: '#6B7280',
    fontSize: 12
  },
  textlg_fontbold_flex1: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700'
  },
  textlg_fontbold_textgray900: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700'
  },
  textwhite_fontbold_textlg: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  w14_h14_roundedfull_bggray200_: {
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    height: 56,
    justifyContent: 'center',
    marginLeft: 24,
    width: 56
  },
  w20_h20_roundedfull_bg002366_i: {
    alignItems: 'center',
    backgroundColor: '#002366',
    borderRadius: 9999,
    height: 80,
    justifyContent: 'center',
    width: 80
  },
  w32_h32_roundedfull_bgwhite_it: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    height: 128,
    justifyContent: 'center',
    width: 128
  },
  w48_h48_roundedfull_bgwhite20_: {
    alignItems: 'center',
    borderRadius: 9999,
    height: 192,
    justifyContent: 'center',
    width: 192
  },
  w64_h64_roundedfull_bggradient: {
    alignItems: 'center',
    borderRadius: 9999,
    height: 256,
    justifyContent: 'center',
    width: 256
  },
  wfull_maxwsm_mb8: {
    marginBottom: 32,
    width: '100%'
  },
});

export default function AudioPlayerScreen() {
  const router = useRouter();
  const { audioUrl, title, moduleId, courseId } = useLocalSearchParams<{ 
    audioUrl?: string; 
    title?: string;
    moduleId?: string;
    courseId?: string;
  }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const [error, setError] = useState<string | null>(null);

  const authUrl = audioUrl ? cleanAndAuthUrl(audioUrl, token) : undefined;
  
  const player = useAudioPlayer(authUrl || "");
  const status = useAudioPlayerStatus(player);

  // Coupe l'audio immédiatement dès que l'écran perd le focus (back, swipe,
  // navigation vers un autre écran).
  useFocusEffect(
    useCallback(() => {
      return () => {
        try { player.pause(); } catch {}
      };
    }, [player])
  );

  useEffect(() => {
    if (IS_DEV) {
      console.log('[AudioPlayer] Status:', {
        playing: status.playing,
        currentTime: status.currentTime,
        duration: status.duration,
        playbackState: status.playbackState,
      });
    }
  }, [status.playing, status.currentTime]);

  const handlePlayPause = async () => {
    try {
      if (status.playing) {
        await player.pause();
      } else {
        await player.play();
      }
    } catch (err: any) {
      if (IS_DEV) console.error('[AudioPlayer] Play/Pause error:', err);
      setError(err.message || "Erreur de lecture");
    }
  };

  const handleRestart = async () => {
    try {
      await player.seekTo(0);
      await player.play();
    } catch (err: any) {
      if (IS_DEV) console.error('[AudioPlayer] Restart error:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const secs = Math.floor(seconds);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    const returnRoute = courseId ? `/(stacks)/(cours)/${courseId}` : '/(tabs)/(home)';
    const params = `?activity=Audio&score=100&total=100&xp=10&moduleId=${moduleId || ''}&moduleTitle=${encodeURIComponent(title || 'Audio')}&courseId=${courseId || ''}&returnRoute=${encodeURIComponent(returnRoute)}`;
    router.push(`/(stacks)/(cours)/result${params}` as any);
  };

  const progress = status.duration && status.duration > 0 
    ? (status.currentTime / status.duration) * 100 
    : 0;

  if (!audioUrl) {
    return (
      <SafeAreaView style={styles.flex1_bgFAF9F6_itemscenter_jus}>
        <ActivityIndicator size="large" color="#002366" />
        <Text style={styles.mt4_textgray600}>URL audio manquante...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.style_7} edges={["top"]}>
        <View style={styles.style_6}>
          <Pressable onPress={() => router.back()} style={styles.style_5}>
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text style={styles.textlg_fontbold_flex1}>{title || 'Audio'}</Text>
        </View>
        <View style={styles.style_4}>
          <Ionicons name="musical-notes" size={64} color="#D1D5DB" />
          <Text style={styles.textgray500_mt4_textcenter}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex1_bgFAF9F6} edges={["top"]}>
      <View style={styles.px5_py4_flexrow_itemscenter}>
        <Pressable onPress={() => router.back()} style={styles.mr4_p2}>
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.textlg_fontbold_textgray900} numberOfLines={1}>
            {title || 'Lecture audio'}
          </Text>
          <Text style={styles.style_3}>Compréhension orale</Text>
        </View>
      </View>

      <View style={styles.flex1_itemscenter_justifycente}>
        <View style={styles.w64_h64_roundedfull_bggradient}>
          <View style={styles.w48_h48_roundedfull_bgwhite20_}>
            <View style={styles.w32_h32_roundedfull_bgwhite_it}>
              <Ionicons 
                name={status.playing ? "musical-notes" : "musical-note"} 
                size={64} 
                color="#002366" 
              />
            </View>
          </View>
        </View>

        <View style={styles.wfull_maxwsm_mb8}>
          <View style={styles.h2_bggray200_roundedfull_overf}>
            <View 
              style={[styles.hfull_bg4a90e2_roundedfull,{ width: `${progress}%` }]}
             />
          </View>
          <View style={styles.flexrow_justifybetween}>
            <Text style={styles.style_2}>{formatTime(status.currentTime)}</Text>
            <Text style={styles.textgray500_textxs}>{formatTime(status.duration || 0)}</Text>
          </View>
        </View>

        <View style={styles.flexrow_itemscenter_justifycen}>
          <Pressable onPress={handleRestart} style={styles.style_1}>
            <Feather name="rotate-ccw" size={24} color="#002366" />
          </Pressable>

          <Pressable 
            onPress={handlePlayPause}
            style={styles.w20_h20_roundedfull_bg002366_i}
          >
            <Feather name={status.playing ? "pause" : "play"} size={32} color="white" />
          </Pressable>

          <View style={styles.w14_h14_roundedfull_bggray200_}>
            <Feather name="skip-forward" size={24} color="#9CA3AF" />
          </View>
        </View>
      </View>

      <View style={styles.px5_py4}>
        <Pressable
          onPress={handleFinish}
          style={styles.bg002366_rounded2xl_py4_itemsc}
        >
          <Text style={styles.textwhite_fontbold_textlg}>Terminer</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
