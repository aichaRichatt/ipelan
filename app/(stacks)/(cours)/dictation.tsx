import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { DictationData, useActivityContent } from "../../../hooks/useActivityContent";
import { audioService } from "../../../services/audio/audioService";
import { RootState } from "../../../services/redux/store";

const EMPTY_DICTATION: DictationData = {
  id: 0,
  title: "Aucune dictée",
  words: [],
};

export default function DictationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    moduleId?: string;
    moduleTitle?: string;
    courseId?: string;
    returnRoute?: string;
    cmid?: string;
    instanceId?: string;
  }>();
  
  const token = useSelector((state: RootState) => state.auth.token);
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  
  const { dictation, isLoading, error } = useActivityContent(
    token || '',
    moduleId,
    instanceId,
    'assign',
    cmid || instanceId,
    courseId,
    params.moduleTitle
  );

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Array<{ word: string; correct: boolean }>>([]);

  const currentDictation = dictation?.words?.length ? dictation : null;
  const words = currentDictation?.words || [];
  const currentWord = words[currentWordIndex] || { word: "", hint: "" };
  const progress = words.length > 0 ? ((currentWordIndex + 1) / words.length) * 100 : 0;
  const totalWords = words.length;

  useEffect(() => {
    return () => {
      audioService.stop();
    };
  }, []);

  const handlePlayAudio = async () => {
    if (dictation?.audioUrl) {
      setIsPlaying(true);
      try {
        await audioService.playRemoteUrl(dictation.audioUrl, token || '');
        setIsPlaying(false);
      } catch {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(true);
      try {
        await audioService.playWord();
        setIsPlaying(false);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const checkAnswer = () => {
    const isCorrect = userInput.toLowerCase().trim() === currentWord.word.toLowerCase();
    setCurrentAnswer(isCorrect);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setAnswers(prev => [...prev, { word: currentWord.word, correct: isCorrect }]);

    setTimeout(() => {
      if (currentWordIndex < totalWords - 1) {
        setCurrentWordIndex(prev => prev + 1);
        setUserInput("");
        setCurrentAnswer(null);
      } else {
        navigateToResult();
      }
    }, 1500);
  };

  const navigateToResult = () => {
    const totalQuestions = totalWords;
    const earnedXp = score * 20;
    const returnRoute = params.returnRoute || `/(stacks)/(cours)/${params.courseId}`;
    const instanceId = params.instanceId || params.moduleId || '0';
    
    router.push({
      pathname: "/(stacks)/(cours)/result",
      params: {
        activity: "Dictée audio",
        score: score.toString(),
        total: totalQuestions.toString(),
        xp: earnedXp.toString(),
        courseId: params.courseId || '',
        moduleId: params.moduleId || '',
        instanceId: instanceId,
        moduleTitle: params.moduleTitle || '',
        returnRoute: encodeURIComponent(returnRoute),
      }
    } as any);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">Dictée audio</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#002366" />
          <Text className="mt-4 text-gray-500">Chargement depuis Moodle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ AFFICHER LES ERREURS EXPLICITEMENT
  if (error || (!dictation && !EMPTY_DICTATION.words.length)) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">Dictée audio</Text>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <View className="bg-white rounded-3xl p-8 items-center border border-gray-200">
            <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
              <Feather name="alert-circle" size={32} color="#EF4444" />
            </View>
            <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
              Aucune activité trouvée
            </Text>
            <Text className="text-gray-500 text-center mb-6">
              Ce contenu n&apos;est pas disponible sur Moodle.{'\n'}
              {error && `Erreur: ${error}`}
            </Text>
            <Pressable
              onPress={() => router.back()}
              className="bg-[#002366] rounded-full px-8 py-3"
            >
              <Text className="text-white font-bold">Retour au cours</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
        <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="black" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">Dictée audio</Text>
          <Text className="text-gray-500 text-xs">
            Mot {currentWordIndex + 1}/{totalWords}
          </Text>
        </View>
        <View className="bg-[#F59E0B] px-3 py-1 rounded-full">
          <Text className="text-white font-bold text-sm">{score} pts</Text>
        </View>
      </View>

      <View className="px-5 mb-4">
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View 
            className="h-full bg-[#F59E0B] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        <View 
          className="bg-white rounded-3xl p-6 mb-6 border border-gray-200"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text className="text-gray-500 text-center mb-4">Écoute le mot et écris-le</Text>
          
          <View className="flex-row items-center justify-center h-16 mb-4">
            {[...Array(18)].map((_, i) => (
              <View 
                key={i}
                className={`w-1 mx-[2px] rounded-full ${isPlaying ? 'bg-[#F59E0B]' : 'bg-gray-300'}`}
                style={{ height: isPlaying ? Math.floor(Math.random() * 32 + 12) : 12 }}
              />
            ))}
          </View>

          <Pressable 
            onPress={handlePlayAudio}
            className="w-16 h-16 rounded-full bg-[#F59E0B] items-center justify-center mx-auto"
          >
            <Feather name={isPlaying ? "pause" : "volume-2"} size={24} color="white" />
          </Pressable>
          
          <Text className="text-center text-gray-600 text-sm mt-4 italic">
            Indice : {currentWord.hint}
          </Text>
        </View>

        <Text className="text-lg font-bold text-gray-900 mb-4 text-center">
          Écris le mot que tu as entendu
        </Text>

        <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-200">
          <TextInput
            value={userInput}
            onChangeText={setUserInput}
            placeholder="Écris ici..."
            placeholderTextColor="#9CA3AF"
            className="text-gray-900 text-lg font-medium text-center"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {currentAnswer !== null && (
          <View className={`rounded-xl p-4 mb-4 ${
            currentAnswer ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <View className="flex-row items-center">
              <Feather 
                name={currentAnswer ? "check-circle" : "x-circle"} 
                size={24} 
                color={currentAnswer ? "#10B981" : "#EF4444"} 
              />
              <Text className={`ml-3 font-bold ${
                currentAnswer ? 'text-green-700' : 'text-red-700'
              }`}>
                {currentAnswer ? "Correct !" : `La bonne réponse était : ${currentWord.word}`}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          onPress={checkAnswer}
          disabled={!userInput.trim() || currentAnswer !== null}
          className={`rounded-2xl py-4 items-center ${
            userInput.trim() && currentAnswer === null 
              ? 'bg-[#002366]' 
              : 'bg-gray-300'
          }`}
        >
          <Text className="text-white font-bold text-lg">Vérifier</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}