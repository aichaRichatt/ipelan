import { AssociationPair, useActivityContent } from "@/hooks/useActivityContent";
import { RootState } from "@/services/redux/store";
import { AntDesign, Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

export default function AssociationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moduleId?: string; moduleTitle?: string; courseId?: string; cmid?: string; instanceId?: string }>();
  const token = useSelector((state: RootState) => state.auth.token);
  
  const moduleId = parseInt(params.moduleId || "0", 10);
  const instanceId = parseInt(params.instanceId || params.moduleId || "0", 10);
  const cmid = parseInt(params.cmid || "0", 10);
  const courseId = parseInt(params.courseId || "0", 10);
  
  const { association: associationData, isLoading, error } = useActivityContent(
    token || '',
    moduleId,
    instanceId,
    'glossary',
    cmid || instanceId,
    courseId,
    params.moduleTitle
  );
  
  const matchItems = associationData?.pairs?.length ? associationData.pairs : [];
  const totalPairs = matchItems.length;
  const isDataReady = !isLoading && matchItems.length > 0;

  const [leftColumn, setLeftColumn] = useState<Array<{item: AssociationPair; originalIndex: number}>>([]);
  const [rightColumn, setRightColumn] = useState<Array<{item: AssociationPair; originalIndex: number}>>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<number[]>([]);
  const [matchedRight, setMatchedRight] = useState<number[]>([]);
  const [errorLeft, setErrorLeft] = useState<number | null>(null);
  const [errorRight, setErrorRight] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (matchItems.length > 0) {
      const left = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
      const right = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
      
      for (let i = right.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [right[i], right[j]] = [right[j], right[i]];
      }
      
      setLeftColumn(left);
      setRightColumn(right);
    }
  }, [matchItems]);

  const progress = totalPairs > 0 ? (matchedLeft.length / totalPairs) * 100 : 0;
  const score = matchedLeft.length;

  const handleContinue = () => {
    const instanceId = params.instanceId || params.moduleId || '0';
    const resultParams = `?activity=Association&score=${score}&total=${totalPairs}&xp=${score * 20}&moduleId=${params.moduleId || ''}&instanceId=${instanceId}&moduleTitle=${encodeURIComponent(params.moduleTitle || 'Exercice')}&courseId=${params.courseId || ''}&returnRoute=${encodeURIComponent(`/(stacks)/(cours)/${params.courseId || ''}`)}`;
    router.push(`/(stacks)/(cours)/result${resultParams}` as any);
  };

  const handleLeftSelect = (index: number) => {
    if (matchedLeft.includes(index)) return;
    if (errorLeft !== null) setErrorLeft(null);
    setSelectedLeft(index);
    // Si un élément de droite est déjà sélectionné, essayer le match immédiatement
    if (selectedRight !== null) {
      tryMatch(index, selectedRight);
    }
  };

  const handleRightSelect = (index: number) => {
    if (matchedRight.includes(index)) return;
    if (errorRight !== null) setErrorRight(null);
    setSelectedRight(index);
    // Si un élément de gauche est déjà sélectionné, essayer le match immédiatement
    if (selectedLeft !== null) {
      tryMatch(selectedLeft, index);
    }
  };

  const tryMatch = (leftIdx: number | null, rightIdx: number | null) => {
    if (leftIdx === null || rightIdx === null) return;
    
    // leftIdx est l'originalIndex, trouver l'index dans leftColumn
    const leftArrayIdx = leftColumn.findIndex(l => l.originalIndex === leftIdx);
    const rightItem = rightColumn[rightIdx];
    const leftItem = leftColumn[leftArrayIdx];
    
    if (!leftItem || !rightItem) return;
    
    // Vérifier si c'est une correspondance correcte (par contenu ou par index original)
    const isMatch = leftItem.item.word === rightItem.item.translation || 
                    leftItem.item.translation === rightItem.item.word ||
                    leftItem.originalIndex === rightItem.originalIndex;
    
    if (isMatch) {
      // Match correct - les deux deviennent verts
      setMatchedLeft(prev => [...prev, leftIdx]);
      setMatchedRight(prev => [...prev, rightIdx]);
      setSelectedLeft(null);
      setSelectedRight(null);
      
      // Vérifier si c'est la fin du jeu (utiliser matchedLeft.length + 1 car le state n'est pas encore mis à jour)
      const newMatchedCount = matchedLeft.length + 1;
      if (newMatchedCount === totalPairs) {
        setTimeout(() => setShowResult(true), 800);
      }
    } else {
      // Erreur - les deux deviennent rouges temporairement
      setErrorLeft(leftIdx);
      setErrorRight(rightIdx);
      setSelectedLeft(null);
      setSelectedRight(null);
      
      // Réinitialiser les erreurs après un délai
      setTimeout(() => {
        setErrorLeft(null);
        setErrorRight(null);
      }, 800);
    }
  };

  const getScoreEmoji = () => {
    const percentage = (score / totalPairs) * 100;
    if (percentage === 100) return "🏆";
    if (percentage >= 80) return "🌟";
    if (percentage >= 60) return "👏";
    if (percentage >= 40) return "💪";
    return "📚";
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">Association de mots</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text className="text-gray-500 mt-4">Chargement des mots...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || matchItems.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
        <View className="px-5 py-4 flex-row items-center bg-[#FAF9F6]">
          <Pressable onPress={() => router.back()} className="mr-4 p-2 -ml-2">
            <Feather name="arrow-left" size={24} color="black" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">Association de mots</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Text className="text-red-500 text-center">{error || 'Aucune donnée trouvée'}</Text>
          <Pressable 
            onPress={() => router.back()} 
            className="mt-4 bg-[#4a90e2] px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (showResult) {
    const percentage = Math.round((score / totalPairs) * 100);
    
    return (
      <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
          <View className="flex-1 items-center justify-center px-5 py-10">
            <View className="bg-white rounded-3xl p-8 items-center shadow-lg w-full max-w-sm">
              <Text className="text-6xl mb-4">{getScoreEmoji()}</Text>
              <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
                {percentage >= 60 ? "Excellent !" : "Bien joué !"}
              </Text>
              <Text className="text-gray-500 text-center mb-6">
                Tu as associé {score} paires correctement
              </Text>
              
              <View className="w-32 h-32 rounded-full border-8 mb-6 items-center justify-center"
                style={{ 
                  borderColor: percentage >= 60 ? '#10B981' : '#EF4444',
                  backgroundColor: `${percentage >= 60 ? '#10B981' : '#EF4444'}10`
                }}
              >
                <Text className="text-4xl font-black" style={{ color: percentage >= 60 ? '#10B981' : '#EF4444' }}>
                  {percentage}%
                </Text>
              </View>

              <View className="bg-yellow-50 rounded-xl px-6 py-3 mb-6 flex-row items-center">
                <Text className="text-xl mr-2">⭐</Text>
                <Text className="text-yellow-700 font-bold text-lg">+{score * 20} XP gagnés</Text>
              </View>

              <View className="flex-row w-full">
                <Pressable
                  onPress={handleContinue}
                  className="flex-1 bg-gray-200 py-4 rounded-xl mr-2"
                >
                  <Text className="text-gray-700 font-bold text-center">Continuer</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSelectedLeft(null);
                    setSelectedRight(null);
                    setMatchedLeft([]);
                    setMatchedRight([]);
                    setErrorLeft(null);
                    setErrorRight(null);
                    setShowResult(false);
                    const left = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
                    const right = matchItems.map((item, idx) => ({ item, originalIndex: idx }));
                    for (let i = right.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [right[i], right[j]] = [right[j], right[i]];
                    }
                    setLeftColumn(left);
                    setRightColumn(right);
                  }}
                  className="flex-1 bg-[#4a90e2] py-4 rounded-xl ml-2"
                >
                  <Text className="text-white font-bold text-center">Recommencer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
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
          <Text className="text-lg font-bold text-gray-900">Association de mots</Text>
          <Text className="text-gray-500 text-xs">
            Trouve les paires
          </Text>
        </View>
        <View className="bg-[#F59E0B] px-3 py-1 rounded-full">
          <Text className="text-white font-bold text-sm">{matchedLeft.length}/{totalPairs}</Text>
        </View>
      </View>

      <View className="px-5 mb-4">
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View 
            className="h-full bg-[#10B981] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        
        <Text className="text-center text-gray-600 mb-6">
          Associe chaque mot Pulaar à sa traduction française
        </Text>

        <View className="flex-row flex-wrap justify-between">
          {leftColumn.map(({ item, originalIndex }) => {
            const isMatched = matchedLeft.includes(originalIndex);
            const isSelected = selectedLeft === originalIndex;
            const isError = errorLeft === originalIndex;
            
            return (
              <Pressable
                key={`left-${originalIndex}`}
                onPress={() => handleLeftSelect(originalIndex)}
                disabled={isMatched}
                className={`w-[48%] rounded-2xl p-4 mb-3 border-2 ${
                  isMatched 
                    ? 'bg-green-100 border-green-500' 
                    : isError
                      ? 'bg-red-100 border-red-500'
                      : isSelected
                        ? 'bg-blue-100 border-[#4a90e2]' 
                        : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-center font-bold text-lg ${
                  isMatched ? 'text-green-700' : isError ? 'text-red-700' : 'text-gray-900'
                }`}>
                  {item.word}
                </Text>
                {isMatched && (
                  <View className="absolute top-1 right-1">
                    <AntDesign name="check-circle" size={16} color="#10B981" />
                  </View>
                )}
                {isError && (
                  <View className="absolute top-1 right-1">
                    <AntDesign name="close-circle" size={16} color="#EF4444" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View className="h-px bg-gray-300 my-6" />

        <Text className="text-center text-gray-600 mb-4">
          Traductions françaises
        </Text>

        <View className="flex-row flex-wrap justify-between">
          {rightColumn.map(({ item, originalIndex }, rightIndex) => {
            const isMatched = matchedRight.includes(rightIndex);
            const isSelected = selectedRight === rightIndex;
            const isError = errorRight === rightIndex;
            
            return (
              <Pressable
                key={`right-${originalIndex}`}
                onPress={() => handleRightSelect(rightIndex)}
                disabled={isMatched}
                className={`w-[48%] rounded-2xl p-4 mb-3 border-2 ${
                  isMatched 
                    ? 'bg-green-100 border-green-500' 
                    : isError
                      ? 'bg-red-100 border-red-500'
                      : isSelected
                        ? 'bg-blue-100 border-[#4a90e2]' 
                        : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-center font-medium ${
                  isMatched ? 'text-green-700' : isError ? 'text-red-700' : 'text-gray-700'
                }`}>
                  {item.translation}
                </Text>
                {isError && (
                  <View className="absolute top-1 right-1">
                    <AntDesign name="close-circle" size={16} color="#EF4444" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View className="mt-6 bg-yellow-50 rounded-2xl p-4">
          <View className="flex-row items-center justify-center">
            <Feather name="info" size={18} color="#F59E0B" />
            <Text className="text-yellow-700 ml-2 text-center">
              Sélectionne un mot Pulaar, puis sa traduction
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
