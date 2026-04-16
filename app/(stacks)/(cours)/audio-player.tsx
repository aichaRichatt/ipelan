import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "@/services/redux/store";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { cleanAndAuthUrl } from "@/services/urlAuth";

const IS_DEV = process.env.NODE_ENV === "development";

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
      <SafeAreaView className="flex-1 bg-[#FAF9F6] items-center justify-center">
        <ActivityIndicator size="large" color="#002366" />
        <Text className="mt-4 text-gray-600">URL audio manquante...</Text>
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
          <Text className="text-lg font-bold flex-1">{title || 'Audio'}</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Ionicons name="musical-notes" size={64} color="#D1D5DB" />
          <Text className="text-gray-500 mt-4 text-center">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={["top"]}>
      <View className="px-5 py-4 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-4 p-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
            {title || 'Lecture audio'}
          </Text>
          <Text className="text-gray-500 text-xs">Compréhension orale</Text>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-5">
        <View className="w-64 h-64 rounded-full bg-gradient-to-br from-[#002366] to-[#4a90e2] items-center justify-center mb-12 shadow-xl">
          <View className="w-48 h-48 rounded-full bg-white/20 items-center justify-center">
            <View className="w-32 h-32 rounded-full bg-white items-center justify-center">
              <Ionicons 
                name={status.playing ? "musical-notes" : "musical-note"} 
                size={64} 
                color="#002366" 
              />
            </View>
          </View>
        </View>

        <View className="w-full max-w-sm mb-8">
          <View className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <View 
              className="h-full bg-[#4a90e2] rounded-full"
              style={{ width: `${progress}%` }}
            />
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-500 text-xs">{formatTime(status.currentTime)}</Text>
            <Text className="text-gray-500 text-xs">{formatTime(status.duration || 0)}</Text>
          </View>
        </View>

        <View className="flex-row items-center justify-center">
          <Pressable onPress={handleRestart} className="w-14 h-14 rounded-full bg-gray-200 items-center justify-center mr-6">
            <Feather name="rotate-ccw" size={24} color="#002366" />
          </Pressable>

          <Pressable 
            onPress={handlePlayPause}
            className="w-20 h-20 rounded-full bg-[#002366] items-center justify-center shadow-lg"
          >
            <Feather name={status.playing ? "pause" : "play"} size={32} color="white" />
          </Pressable>

          <View className="w-14 h-14 rounded-full bg-gray-200 items-center justify-center ml-6">
            <Feather name="skip-forward" size={24} color="#9CA3AF" />
          </View>
        </View>
      </View>

      <View className="px-5 py-4">
        <Pressable
          onPress={handleFinish}
          className="bg-[#002366] rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-bold text-lg">Terminer</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
