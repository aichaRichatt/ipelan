import { AntDesign, Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useLogin } from "../../../hooks/useLogin";

interface Badge {
  id: number;
  name: string;
  emoji: string;
  description: string;
  isEarned: boolean;
  earnedDate?: string;
}

interface Activity {
  id: number;
  title: string;
  type: string;
  date: string;
  xp: number;
  score: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  avatar: string;
  isCurrentUser: boolean;
}

const BADGES: Badge[] = [
  { id: 1, name: "Premier pas", emoji: "🎯", description: "Complète ta première leçon", isEarned: true, earnedDate: "15 Jan 2026" },
  { id: 2, name: "Série de 3", emoji: "🔥", description: "3 jours consécutifs", isEarned: true, earnedDate: "18 Jan 2026" },
  { id: 3, name: "Quiz Master", emoji: "🏆", description: "Score 100% à un quiz", isEarned: true, earnedDate: "20 Jan 2026" },
  { id: 4, name: "Série de 7", emoji: "💎", description: "7 jours consécutifs", isEarned: false },
  { id: 5, name: "Expert Pulaar", emoji: "🌟", description: "Termine tous les modules", isEarned: false },
  { id: 6, name: "Champion", emoji: "👑", description: "500 XP gagnés", isEarned: false },
];

const RECENT_ACTIVITIES: Activity[] = [
  { id: 1, title: "Quiz - Salutations", type: "quiz", date: "Aujourd'hui", xp: 20, score: "9/10" },
  { id: 2, title: "Dictée audio", type: "dictation", date: "Hier", xp: 15, score: "2/3" },
  { id: 3, title: "Association", type: "exercise", date: "Hier", xp: 20, score: "5/5" },
  { id: 4, title: "Compréhension orale", type: "listening", date: "Il y a 2 jours", xp: 10, score: "3/3" },
];

const TOP_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "Amadou D.", xp: 1250, avatar: "A", isCurrentUser: false },
  { rank: 2, name: "Fatima S.", xp: 1180, avatar: "F", isCurrentUser: false },
  { rank: 3, name: "Ibrahim M.", xp: 1050, avatar: "I", isCurrentUser: false },
  { rank: 4, name: "Maimouna B.", xp: 980, avatar: "M", isCurrentUser: true },
  { rank: 5, name: "Cheikh O.", xp: 920, avatar: "C", isCurrentUser: false },
];

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useLogin();

  const earnedBadges = BADGES.filter(b => b.isEarned).length;
  const currentUserRank = TOP_LEADERBOARD.find(e => e.isCurrentUser);
  const topThree = TOP_LEADERBOARD.slice(0, 3);

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      {/* Header */}
      <View className="px-5 py-4 flex-row justify-between items-center">
        <Text className="text-lg font-black tracking-wider uppercase text-gray-800">PROGRESSION</Text>
        <Pressable className="p-2" onPress={() => router.push("/(settings)/index")}>
          <Feather name="settings" size={22} color="#374151" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} >
        
        {/* User Stats Card */}
        <View className="px-5 mb-6">
          <View className="bg-white rounded-3xl p-6 border border-gray-200" style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}>
            <View className="flex-row items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-[#002366] items-center justify-center mr-4">
                <Text className="text-white text-2xl font-bold">
                  {user?.firstname?.charAt(0) || 'A'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-gray-900">
                  {user?.firstname || "Apprenant"}
                </Text>
                <Text className="text-gray-500 text-sm">Niveau Pulaar Fondamental</Text>
              </View>
            </View>

            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-yellow-100 items-center justify-center mb-2">
                  <Feather name="star" size={24} color="#F59E0B" />
                </View>
                <Text className="text-xl font-bold text-gray-900">{user?.ipelan_xp || 342}</Text>
                <Text className="text-xs text-gray-500">XP Total</Text>
              </View>
              
              <View className="w-px bg-gray-200" />
              
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center mb-2">
                  <Feather name="award" size={24} color="#10B981" />
                </View>
                <Text className="text-xl font-bold text-gray-900">3</Text>
                <Text className="text-xs text-gray-500">Niveau</Text>
              </View>
              
              <View className="w-px bg-gray-200" />
              
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-orange-100 items-center justify-center mb-2">
                  <Text className="text-xl">🔥</Text>
                </View>
                <Text className="text-xl font-bold text-gray-900">{user?.streak || 7}</Text>
                <Text className="text-xs text-gray-500">Jours</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Classement Section */}
        <View className="px-5 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">Classement</Text>
            <View className="flex-row items-center">
              <View className="bg-[#F59E0B] rounded-full px-3 py-1 mr-2">
                <Text className="text-white text-xs font-bold">#{currentUserRank?.rank || '-'}</Text>
              </View>
              <Text className="text-gray-500 text-xs">Ta position</Text>
            </View>
          </View>
          
          <View className="bg-white rounded-3xl p-4 border border-gray-200">
            {/* Top 3 Podium */}
            <View className="flex-row justify-center items-end mb-4 pb-2">
              {/* 2nd Place */}
              {topThree[1] && (
                <View className="items-center mx-2">
                  <View className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                    topThree[1].isCurrentUser ? 'bg-[#F59E0B]' : 'bg-gray-300'
                  }`}>
                    <Text className={`font-bold ${topThree[1].isCurrentUser ? 'text-white' : 'text-gray-600'}`}>
                      {topThree[1].avatar}
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-gray-700">{topThree[1].name}</Text>
                  <Text className="text-xs text-gray-500">{topThree[1].xp} XP</Text>
                  <View className="w-16 h-16 bg-[#D1D5DB] rounded-t-xl" />
                  <Text className="font-bold text-gray-600">2</Text>
                </View>
              )}
              
              {/* 1st Place */}
              {topThree[0] && (
                <View className="items-center mx-2 z-10">
                  <Text className="text-lg mb-1">👑</Text>
                  <View className={`w-14 h-14 rounded-full items-center justify-center mb-2 ${
                    topThree[0].isCurrentUser ? 'bg-[#F59E0B]' : 'bg-yellow-400'
                  }`}>
                    <Text className={`font-bold text-lg ${topThree[0].isCurrentUser ? 'text-white' : 'text-yellow-900'}`}>
                      {topThree[0].avatar}
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-gray-900">{topThree[0].name}</Text>
                  <Text className="text-xs text-gray-500">{topThree[0].xp} XP</Text>
                  <View className="w-20 h-20 bg-[#FBBF24] rounded-t-3xl" />
                  <Text className="font-bold text-yellow-700 text-lg">1</Text>
                </View>
              )}
              
              {/* 3rd Place */}
              {topThree[2] && (
                <View className="items-center mx-2">
                  <View className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                    topThree[2].isCurrentUser ? 'bg-[#F59E0B]' : 'bg-orange-200'
                  }`}>
                    <Text className={`font-bold ${topThree[2].isCurrentUser ? 'text-white' : 'text-orange-700'}`}>
                      {topThree[2].avatar}
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-gray-700">{topThree[2].name}</Text>
                  <Text className="text-xs text-gray-500">{topThree[2].xp} XP</Text>
                  <View className="w-16 h-12 bg-[#E5E7EB] rounded-t-xl" />
                  <Text className="font-bold text-gray-500">3</Text>
                </View>
              )}
            </View>
            
            {/* Rest of Leaderboard */}
            {TOP_LEADERBOARD.slice(3).map((entry) => (
              <View 
                key={entry.rank}
                className={`flex-row items-center py-3 px-2 rounded-xl mb-1 ${
                  entry.isCurrentUser ? 'bg-[#F59E0B]/10 border border-[#F59E0B]/30' : ''
                }`}
              >
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                  entry.isCurrentUser ? 'bg-[#F59E0B]' : 'bg-gray-100'
                }`}>
                  <Text className={`font-bold text-sm ${entry.isCurrentUser ? 'text-white' : 'text-gray-600'}`}>
                    {entry.rank}
                  </Text>
                </View>
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                  entry.isCurrentUser ? 'bg-[#F59E0B]/20' : 'bg-gray-100'
                }`}>
                  <Text className={`font-bold text-sm ${entry.isCurrentUser ? 'text-[#F59E0B]' : 'text-gray-500'}`}>
                    {entry.avatar}
                  </Text>
                </View>
                <Text className={`flex-1 font-medium ${entry.isCurrentUser ? 'text-[#F59E0B]' : 'text-gray-900'}`}>
                  {entry.name}
                  {entry.isCurrentUser && ' (Toi)'}
                </Text>
                <Text className={`font-bold ${entry.isCurrentUser ? 'text-[#F59E0B]' : 'text-gray-500'}`}>
                  {entry.xp} XP
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Badges Section */}
        <View className="px-5 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">Badges</Text>
            <Text className="text-sm text-gray-500">{earnedBadges}/{BADGES.length}</Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              {BADGES.map(badge => (
                <View 
                  key={badge.id}
                  className={`rounded-2xl p-4 mr-3 items-center w-24 ${
                    badge.isEarned ? 'bg-white border border-gray-200' : 'bg-gray-100 opacity-50'
                  }`}
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <Text className="text-3xl mb-2">{badge.emoji}</Text>
                  <Text className="text-xs font-bold text-gray-900 text-center">{badge.name}</Text>
                  {badge.isEarned ? (
                    <View className="mt-1">
                      <Feather name="check-circle" size={12} color="#10B981" />
                    </View>
                  ) : (
                    <Feather name="lock" size={12} color="#9CA3AF" className="mt-1" />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Progress Overview */}
        <View className="px-5 mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Aperçu</Text>
          
          <View className="bg-white rounded-2xl p-4 border border-gray-200 mb-3">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-medium text-gray-700">Leçons complétées</Text>
              <Text className="text-sm font-bold text-gray-900">24/45</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View className="h-full bg-[#4a90e2] rounded-full" style={{ width: '53%' }} />
            </View>
          </View>

          <View className="bg-white rounded-2xl p-4 border border-gray-200 mb-3">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-medium text-gray-700">Quiz réussis</Text>
              <Text className="text-sm font-bold text-gray-900">12/15</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View className="h-full bg-[#10B981] rounded-full" style={{ width: '80%' }} />
            </View>
          </View>

          <View className="bg-white rounded-2xl p-4 border border-gray-200">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-medium text-gray-700">Temps d'apprentissage</Text>
              <Text className="text-sm font-bold text-gray-900">4h 32min</Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View className="h-full bg-[#F59E0B] rounded-full" style={{ width: '35%' }} />
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View className="px-5 mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Activité récente</Text>
          
          {RECENT_ACTIVITIES.map(activity => (
            <View 
              key={activity.id}
              className="bg-white rounded-2xl p-4 mb-3 border border-gray-200 flex-row items-center"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 1,
              }}
            >
              <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                activity.type === 'quiz' ? 'bg-red-100' :
                activity.type === 'dictation' ? 'bg-yellow-100' :
                activity.type === 'exercise' ? 'bg-green-100' :
                'bg-blue-100'
              }`}>
                <Feather 
                  name={
                    activity.type === 'quiz' ? 'edit-2' :
                    activity.type === 'dictation' ? 'edit' :
                    activity.type === 'exercise' ? 'link' :
                    'headphones'
                  }
                  size={18}
                  color={
                    activity.type === 'quiz' ? '#EF4444' :
                    activity.type === 'dictation' ? '#F59E0B' :
                    activity.type === 'exercise' ? '#10B981' :
                    '#4a90e2'
                  }
                />
              </View>
              
              <View className="flex-1">
                <Text className="font-medium text-gray-900 text-sm">{activity.title}</Text>
                <Text className="text-xs text-gray-500">{activity.date}</Text>
              </View>
              
              <View className="items-end">
                <Text className="font-bold text-[#F59E0B] text-sm">+{activity.xp} XP</Text>
                <Text className="text-xs text-gray-500">{activity.score}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
