import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLogin } from "../../../hooks/useLogin";

interface ModuleData {
  id: string;
  moduleName: string;
  title: string;
  description: string;
  xp: number;
  isLocked: boolean;
  lessonsCount: number;
  completedLessons: number;
  icon: string;
  iconColor: string;
  iconBg: string;
  levelId: number; 
}

interface QuickActionData {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  bgColor: string;
  iconColor: string;
  route: string;
}

const MOCK_MODULES: ModuleData[] = [
  {
    id: "1",
    moduleName: "Module 1",
    title: "Salutations",
    description: "Apprende à saluer en Pulaar",
    xp: 30,
    isLocked: false,
    lessonsCount: 5,
    completedLessons: 5,
    icon: "smile",
    iconColor: "#10B981",
    iconBg: "bg-green-100",
    levelId: 1,
  },
  {
    id: "2",
    moduleName: "Module 2",
    title: "La famille",
    description: "Les membres de la famille",
    xp: 30,
    isLocked: false,
    lessonsCount: 4,
    completedLessons: 1,
    icon: "users",
    iconColor: "#6366F1",
    iconBg: "bg-indigo-100",
    levelId: 1,
  },
  {
    id: "3",
    moduleName: "Module 3",
    title: "Les nombres",
    description: "Apprendre à compter",
    xp: 30,
    isLocked: true,
    lessonsCount: 6,
    completedLessons: 0,
    icon: "hash",
    iconColor: "#F59E0B",
    iconBg: "bg-amber-100",
    levelId: 2,
  },
  {
    id: "4",
    moduleName: "Module 4",
    title: "Les couleurs",
    description: "Les couleurs en Pulaar",
    xp: 25,
    isLocked: true,
    lessonsCount: 5,
    completedLessons: 0,
    icon: "droplet",
    iconColor: "#EC4899",
    iconBg: "bg-pink-100",
    levelId: 3,
  },
];

const MOCK_QUICK_ACTIONS: QuickActionData[] = [
  {
    id: "1",
    title: "Quiz",
    subtitle: "Teste tes connaissances",
    icon: "edit-2",
    bgColor: "bg-blue-50",
    iconColor: "#4a90e2",
    route: "/(quiz)/index",
  },
  {
    id: "2",
    title: "Oral",
    subtitle: "Écoute et apprends",
    icon: "headphones",
    bgColor: "bg-green-50",
    iconColor: "#10B981",
    route: "/(stacks)/(cours)/listening",
  },
  {
    id: "3",
    title: "Dictée",
    subtitle: "Écris ce que tu entends",
    icon: "edit-3",
    bgColor: "bg-amber-50",
    iconColor: "#F59E0B",
    route: "/(stacks)/(cours)/dictation",
  },
  {
    id: "4",
    title: "Association",
    subtitle: "Associe les mots",
    icon: "link",
    bgColor: "bg-purple-50",
    iconColor: "#9333EA",
    route: "/(stacks)/(cours)/association",
  },
];

const getIconComponent = (iconName: string, size: number, color: string) => {
  switch (iconName) {
    case "smile": return <Feather name="smile" size={size} color={color} />;
    case "users": return <Feather name="users" size={size} color={color} />;
    case "hash": return <Feather name="hash" size={size} color={color} />;
    case "droplet": return <Feather name="droplet" size={size} color={color} />;
    case "edit-2": return <Feather name="edit-2" size={size} color={color} />;
    case "headphones": return <Feather name="headphones" size={size} color={color} />;
    case "edit-3": return <Feather name="edit-3" size={size} color={color} />;
    case "link": return <Feather name="link" size={size} color={color} />;
    default: return <Feather name="book" size={size} color={color} />;
  }
};
const DefaultProfileImage = require('../../../assets/images/defaultprofile.png');

export default function HomeScreen() {
  const { user: loggedUser, token } = useLogin();
  const router = useRouter();
  const [selectedLevelId, setSelectedLevelId] = useState<number>(1);

  const handleSettingsPress = () => {
    router.push("/(settings)/index" as any);
  };

  const handleModulePress = (module: ModuleData) => {
    if (!module.isLocked) {
      router.push(`/(stacks)/(cours)/${module.id}` as any);
    }
  };

  const filteredModules = MOCK_MODULES.filter(m => m.levelId === selectedLevelId);

  return (  
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="px-5 pt-4">
          
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
              <Pressable onPress={() => router.push("/(tabs)/(profile)")}>
                <View className="w-12 h-12 rounded-full border-2 border-[#002366] p-0.5 overflow-hidden">
                  <Image 
                    source={loggedUser?.image ? { uri: loggedUser?.image } : DefaultProfileImage} 
                    className="w-full h-full rounded-full"
                  />
                </View>
              </Pressable>
              <View className="ml-3">
                <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  Àndu,
                </Text>
                <Text className="text-lg font-bold text-gray-900">
                  {loggedUser?.firstname || loggedUser?.username || "Ahmadou"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center space-x-3">
              <View className="flex-row items-center bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                <Text className="text-sm mr-1">🔥</Text>
                <Text className="font-bold text-xs text-[#EF4444]">{loggedUser?.streak ?? 5}</Text>
              </View>
              <View className="flex-row items-center bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                <Ionicons name="medal" size={14} color="#8B5CF6" />
                <Text className="font-bold text-xs text-[#8B5CF6] ml-1">3</Text>
              </View>
              <Pressable onPress={() => router.push("/(settings)")} className="p-2 bg-white rounded-full border border-gray-100 shadow-sm">
                <Feather name="settings" size={18} color="#374151" />
              </Pressable>
            </View>
          </View>

          <View className="flex-row flex-wrap justify-between mb-8">
            <StatsCard 
              label="XP Total" 
              value={`${loggedUser?.ipelan_xp ?? 1240}`} 
              icon={<AntDesign name="star" size={16} color="#F59E0B" />}
              bgColor="bg-orange-50"
              textColor="text-orange-600"
            />
            <StatsCard 
              label="Jours Série" 
              value={`${loggedUser?.streak ?? 5}`} 
              icon={<Ionicons name="flame" size={16} color="#EF4444" />}
              bgColor="bg-red-50"
              textColor="text-red-600"
            />
            <StatsCard 
              label="Badges" 
              value="3" 
              icon={<Ionicons name="medal" size={16} color="#8B5CF6" />}
              bgColor="bg-purple-50"
              textColor="text-purple-600"
            />
            <StatsCard 
              label="Leçons" 
              value="12" 
              icon={<Feather name="book-open" size={16} color="#10B981" />}
              bgColor="bg-green-50"
              textColor="text-green-600"
            />
          </View>

          <Pressable 
            onPress={() => router.push("/(stacks)/(cours)/learning-path" as any)}
            className="mb-8"
          >
            <View 
              className="bg-[#002366] rounded-3xl p-5 overflow-hidden"
              style={{
                shadowColor: "#002366",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 15,
                elevation: 8,
              }}
            >
              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">
                    Reprendre l'activité
                  </Text>
                  <Text className="text-white text-xl font-bold">
                    La famille en Pulaar
                  </Text>
                </View>
                <View className="bg-white/20 p-2 rounded-xl">
                  <Ionicons name="play" size={24} color="white" />
                </View>
              </View>
              
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="text-white/80 text-xs">Progression</Text>
                  <Text className="text-white text-xs font-bold">60%</Text>
                </View>
                <View className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <View className="h-full bg-orange-400 rounded-full w-[60%]" />
                </View>
              </View>

              <View className="flex-row justify-between items-center">
                <View className="flex-row -space-x-2">
                </View>
                <View className="bg-white px-4 py-2 rounded-full">
                  <Text className="text-[#002366] font-bold text-xs">Continuer</Text>
                </View>
              </View>
            </View>
          </Pressable>

          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900">Modules</Text>
              <Pressable onPress={() => router.push("/(tabs)/(cours)/index" as any)}>
                <Text className="text-blue-600 font-semibold text-xs">Voir tout</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row space-x-2">
                {['Fondamental', 'Intermédiaire', 'Avancé'].map((level, index) => (
                  <Pressable
                    key={level}
                    onPress={() => setSelectedLevelId(index + 1)}
                    className={`px-5 py-2.5 rounded-2xl ${
                      selectedLevelId === index + 1 
                        ? 'bg-[#002366]' 
                        : 'bg-white border border-gray-100'
                    } shadow-sm`}
                  >
                    <Text className={`font-bold text-sm ${
                      selectedLevelId === index + 1 
                        ? 'text-white' 
                        : 'text-gray-700'
                    }`}>
                      {level}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            
            <View>
              {filteredModules.length > 0 ? (
                filteredModules.map((module) => (
                  <HomeModuleCard 
                    key={module.id}
                    module={module}
                    onPress={() => handleModulePress(module)}
                  />
                ))
              ) : (
                <View className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 items-center">
                  <Feather name="lock" size={32} color="#D1D5DB" />
                  <Text className="text-gray-400 text-sm mt-2 font-medium">Bientôt disponible</Text>
                </View>
              )}
            </View>
          </View>

          {/*<View className="mt-4 mb-4">
            <Text className="text-xl font-bold text-gray-900 mb-4">Activités éclairs</Text>
            <View className="flex-row flex-wrap justify-between">
              {MOCK_QUICK_ACTIONS.map((action) => (
                <QuickActionCard 
                  key={action.id}
                  action={action}
                  icon={getIconComponent(action.icon, 24, action.iconColor)}
                  onPress={() => router.push(action.route as any)}
                />
              ))}
            </View>
          </View>*/}

          {/*  Streak Highlight (si streak >= 3) */}
          {/*{(loggedUser?.streak ?? 5) >= 3 && (
            <View className="mt-4 bg-orange-100/50 p-4 rounded-2xl border border-orange-200 flex-row items-center">
              <View className="w-12 h-12 bg-orange-400 rounded-full items-center justify-center mr-4">
                <Ionicons name="flame" size={24} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-orange-900 font-bold">Incroyable !</Text>
                <Text className="text-orange-700 text-xs">Tu as une série de {loggedUser?.streak ?? 5} jours. Continue comme ça !</Text>
              </View>
            </View>
          )}*/}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatsCard({ label, value, icon, bgColor, textColor }: { 
  label: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}) {
  return (
    <View className={`w-[48%] ${bgColor} p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm`}>
      <View className="flex-row justify-between items-center mb-1">
        <View className="p-1.5 rounded-lg bg-white shadow-sm">
          {icon}
        </View>
        <Text className={`text-base font-bold ${textColor}`}>{value}</Text>
      </View>
      <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-tight">{label}</Text>
    </View>
  );
}

function HomeModuleCard({ module, onPress }: { 
  module: ModuleData;
  onPress: () => void;
}) {
  const progress = Math.round((module.completedLessons / module.lessonsCount) * 100);
  const isCompleted = progress === 100;

  return (
    <Pressable 
      onPress={onPress}
      className={`bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm ${module.isLocked ? 'opacity-60' : ''}`}
    >
      <View className="flex-row items-center mb-3">
        <View className={`${module.isLocked ? 'bg-gray-100' : module.iconBg} w-10 h-10 rounded-xl items-center justify-center mr-3`}>
          {module.isLocked ? (
            <Feather name="lock" size={18} color="#9CA3AF" />
          ) : (
            getIconComponent(module.icon, 20, module.iconColor)
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>{module.title}</Text>
            {isCompleted ? (
              <View className="bg-green-100 p-1 rounded-full">
                <Ionicons name="checkmark" size={12} color="#059669" />
              </View>
            ) : (
              <Text className="text-orange-500 font-bold text-[10px]">+{module.xp} XP</Text>
            )}
          </View>
          <Text className="text-gray-500 text-[10px]" numberOfLines={1}>{module.description}</Text>
        </View>
      </View>

      {!module.isLocked && (
        <View>
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-gray-400 text-[9px] font-medium">{module.completedLessons}/{module.lessonsCount} leçons</Text>
            <Text className="text-gray-600 text-[9px] font-bold">{progress}%</Text>
          </View>
          <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <View 
              className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`} 
              style={{ width: `${progress}%` }} 
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

function QuickActionCard({ action, icon, onPress }: { 
  action: QuickActionData;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable 
      onPress={onPress}
      className={`w-[48%] ${action.bgColor} rounded-3xl p-4 mb-3 border border-gray-100 shadow-sm`}
    >
      <View className="w-10 h-10 rounded-2xl bg-white items-center justify-center mb-3 shadow-sm">
        {icon}
      </View>
      <Text className="font-bold text-gray-900 text-sm">{action.title}</Text>
      <Text className="text-gray-500 text-[10px] mt-0.5" numberOfLines={1}>{action.subtitle}</Text>
    </Pressable>
  );
}
