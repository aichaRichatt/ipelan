import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

interface LessonContent {
  id: number;
  title: string;
  type: string;
  vocabulary: { word: string; translation: string; audio?: boolean }[];
  text: string;
  images: { label: string; color: string }[];
}

const LESSON_CONTENT: Record<number, LessonContent> = {
  1: {
    id: 1,
    title: "Introduction aux salutations",
    type: "audio",
    vocabulary: [
      { word: "Jaa", translation: "Bonjour", audio: true },
      { word: "Baadi", translation: "Au revoir", audio: true },
      { word: "Ndeyni", translation: "Merci", audio: true },
      { word: "Min yaha", translation: "Comment vas-tu ?", audio: true },
    ],
    text: "En Pulaar, les salutations sont tres importantes dans la vie quotidienne. Quand tu rencontres quelqu'un, il est poli de dire 'Jaa' pour saluer. Si tu veux dire au revoir, utilise 'Baadi'. N'oublie pas de dire 'Ndeyni' quand quelqu'un fait quelque chose pour toi !",
    images: [
      { label: "Deux personnes qui se saluent", color: "#60A5FA" },
      { label: "Une famille Mauritanienne", color: "#34D399" },
    ],
  },
  2: {
    id: 2,
    title: "Vocabulaire de base",
    type: "reading",
    vocabulary: [
      { word: "Nde", translation: "Mère" },
      { word: "Bapp", translation: "Père" },
      { word: "Yiiro", translation: "Fils/Fille" },
      { word: "Kombo", translation: "Chat" },
    ],
    text: "Maintenant, apprenons le vocabulaire de base en Pulaar. La mere se dit 'Nde' et le pere se dit 'Bapp'. Les enfants sont appeles 'Yiiro'. Dans les maisons mauritaniennes, on trouve souvent des chats appeles 'Kombo'.",
    images: [
      { label: "Une mere avec son enfant", color: "#F87171" },
      { label: "Un chat dans une maison", color: "#FBBF24" },
    ],
  },
};

export default function LessonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lessonId = parseInt(id || "1", 10);
  const lesson = LESSON_CONTENT[lessonId] || LESSON_CONTENT[1];
  
  const [showTranslation, setShowTranslation] = useState<Record<number, boolean>>({});
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isPlaying, setIsPlaying] = useState<Record<number, boolean>>({});
  const [scrolledPast, setScrolledPast] = useState(false);

  const handlePlayAudio = (index: number) => {
    setIsPlaying(prev => ({ ...prev, [index]: true }));
    setTimeout(() => {
      setIsPlaying(prev => ({ ...prev, [index]: false }));
    }, 2000);
  };

  const toggleTranslation = (index: number) => {
    setShowTranslation(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleContinue = () => {
    router.push("/(quiz)/index");
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{lesson.title}</Text>
          <Text className="text-gray-500 text-xs">Leçon {lessonId}</Text>
        </View>
      </View>

      <View className="px-5 mb-4">
        <View className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <View className="h-full bg-[#F59E0B] rounded-full" style={{ width: '30%' }} />
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <Text className="text-2xl font-bold text-gray-900 mb-6">{lesson.title}</Text>

        <Text className="text-base text-gray-700 leading-relaxed mb-8">
          {lesson.text}
        </Text>

        <Text className="text-lg font-bold text-gray-900 mb-4">Vocabulaire</Text>
        
        <View className="mb-8">
          {lesson.vocabulary.map((item, index) => (
            <View key={index} className="bg-white rounded-2xl p-4 mb-3 border border-gray-200">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <Pressable
                    onPress={() => item.audio && handlePlayAudio(index)}
                    className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                      item.audio ? 'bg-[#60A5FA]/20' : 'bg-gray-100'
                    }`}
                  >
                    {item.audio ? (
                      isPlaying[index] ? (
                        <View className="w-4 h-4 bg-[#60A5FA] rounded-full animate-pulse" />
                      ) : (
                        <Feather name="volume-2" size={18} color="#60A5FA" />
                      )
                    ) : (
                      <Feather name="book-open" size={18} color="#9CA3AF" />
                    )}
                  </Pressable>
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-gray-900">{item.word}</Text>
                    {showTranslation[index] && (
                      <Text className="text-gray-500 text-sm mt-1">{item.translation}</Text>
                    )}
                  </View>
                </View>
                <Pressable
                  onPress={() => toggleTranslation(index)}
                  className="bg-[#002366] px-4 py-2 rounded-full"
                >
                  <Text className="text-white text-sm font-medium">
                    {showTranslation[index] ? "Masquer" : "Traduire"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <Text className="text-lg font-bold text-gray-900 mb-4">Illustrations</Text>
        
        <View className="mb-8">
          {lesson.images.map((img, index) => (
            <View 
              key={index}
              className="rounded-2xl p-6 mb-3 items-center"
              style={{ backgroundColor: img.color + '20' }}
            >
              <View 
                className="w-full h-32 rounded-xl items-center justify-center mb-2"
                style={{ backgroundColor: img.color + '30' }}
              >
                <Feather name="image" size={40} color={img.color} />
              </View>
              <Text className="text-gray-700 text-sm text-center">{img.label}</Text>
            </View>
          ))}
        </View>

        <View className="h-32" />
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-5 py-4">
        <Pressable
          onPress={handleContinue}
          disabled={!hasScrolledToBottom}
          className={`rounded-2xl py-4 items-center ${
            hasScrolledToBottom ? 'bg-[#002366]' : 'bg-gray-300'
          }`}
        >
          <Text className="text-white font-bold text-lg">
            Continuer vers les activités
          </Text>
        </Pressable>
        {!hasScrolledToBottom && (
          <Text className="text-center text-gray-400 text-xs mt-2">
            Déroule la page pour continuer
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
