import { AntDesign, Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLogin } from "../../../hooks/useLogin";
import { useRouter } from "expo-router";

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
    description: "Apprendre à saluer en Pulaar",
    xp: 12,
    isLocked: false,
    lessonsCount: 5,
    completedLessons: 2,
    icon: "smile",
    iconColor: "#92400E",
    iconBg: "bg-orange-100",
  },
  {
    id: "2",
    moduleName: "Module 2",
    title: "La famille",
    description: "Les membres de la famille",
    xp: 30,
    isLocked: false,
    lessonsCount: 4,
    completedLessons: 0,
    icon: "users",
    iconColor: "#059669",
    iconBg: "bg-green-100",
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
    iconColor: "#DC2626",
    iconBg: "bg-red-100",
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
    iconColor: "#7C3AED",
    iconBg: "bg-purple-100",
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
    title: "Audio",
    subtitle: "Écoute et apprends",
    icon: "volume-2",
    bgColor: "bg-green-50",
    iconColor: "#10B981",
    route: "/(tabs)/(cours)/listening",
  },
  {
    id: "3",
    title: "Dictée",
    subtitle: "Écris ce que tu entends",
    icon: "edit",
    bgColor: "bg-yellow-50",
    iconColor: "#F59E0B",
    route: "/(tabs)/(cours)/dictation",
  },
  {
    id: "4",
    title: "Association",
    subtitle: "Associe les mots",
    icon: "link",
    bgColor: "bg-purple-50",
    iconColor: "#9333EA",
    route: "/(tabs)/(cours)/association",
  },
];

const getIconComponent = (iconName: string, size: number, color: string) => {
  switch (iconName) {
    case "smile": return <Feather name="smile" size={size} color={color} />;
    case "users": return <Feather name="users" size={size} color={color} />;
    case "hash": return <Feather name="hash" size={size} color={color} />;
    case "droplet": return <Feather name="droplet" size={size} color={color} />;
    case "edit-2": return <Feather name="edit-2" size={size} color={color} />;
    case "volume-2": return <Feather name="volume-2" size={size} color={color} />;
    case "edit": return <Feather name="edit" size={size} color={color} />;
    case "link": return <Feather name="link" size={size} color={color} />;
    case "book": return <Feather name="book" size={size} color={color} />;
    default: return <Feather name="book" size={size} color={color} />;
  }
};

export default function HomeScreen() {
  const { user: loggedUser, token } = useLogin();
  const router = useRouter();
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(1);

  useEffect(() => {
    // Auth bypassed for UI testing
  }, [token]);

  const handleSettingsPress = () => {
    router.push("/(settings)/index");
  };

  const handleModulePress = (module: ModuleData) => {
    if (!module.isLocked) {
      router.push(`/(tabs)/(cours)/${module.id}`);
    }
  };

  const handleQuickActionPress = (action: QuickActionData) => {
    router.push(action.route as any);
  };

  return (  
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top']}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
      >
        <View className="px-5 py-2 mt-2 ">
          
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
              <View className="bg-gray-800 rounded-full p-2 mr-3">
                <AntDesign name="user" size={24} color="white" />
              </View>
              <View>
                <Text className="text-gray-500 text-xs font-semibold tracking-wider uppercase">
                  BIENVENUE,
                </Text>
                <Text className="text-lg font-bold text-gray-900 uppercase">
                  {loggedUser?.firstname || loggedUser?.username || "AMADOU"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="flex-row items-center mr-4">
                <View className="w-3 h-3 bg-yellow-400 rounded-full mr-1"></View>
                <Text className="font-bold text-xs">{loggedUser?.coins ?? 340}</Text>
              </View>
              <Pressable onPress={handleSettingsPress} className="p-2">
                <Feather name="settings" size={22} color="#374151" />
              </Pressable>
            </View>
          </View>

          <MainCard 
            title="PULAAR — FONDAMENTAL" 
            progress={68} 
            completedText="68% Complété" 
            moduleText="5/8 Modules"
          />

          <View className="mt-8 mb-4">
            <Text className="text-lg font-bold mb-4 text-black">Niveau</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row space-x-2">
                {['Fondamental', 'Intermédiaire', 'Avancé'].map((level, index) => (
                  <Pressable
                    key={level}
                    onPress={() => setSelectedLevelId(index + 1)}
                    className={`px-4 py-2 rounded-full ${
                      selectedLevelId === index + 1 
                        ? 'bg-[#002366]' 
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <Text className={`font-semibold text-sm ${
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
          </View>

          <View className="mt-2">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-black">Cours disponibles</Text>
            </View>
            
            {MOCK_MODULES.map((module) => (
              <ModuleCard 
                key={module.id}
                moduleName={module.moduleName}
                title={module.title}
                description={module.description}
                xp={module.xp}
                isLocked={module.isLocked}
                icon={getIconComponent(module.icon, 20, module.iconColor)}
                iconBgColor={module.iconBg}
                onPress={() => handleModulePress(module)}
                lessonInfo={`${module.completedLessons}/${module.lessonsCount} leçons`}
              />
            ))}
          </View>

          <View className="mt-8 mb-6">
            <Text className="text-lg font-bold mb-4 text-black">Actions rapides</Text>
            <View className="flex-row flex-wrap justify-between">
              {MOCK_QUICK_ACTIONS.map((action) => (
                <QuickActionCard 
                  key={action.id}
                  title={action.title}
                  subtitle={action.subtitle}
                  icon={getIconComponent(action.icon, 24, action.iconColor)}
                  bgColor={action.bgColor}
                  onPress={() => handleQuickActionPress(action)}
                />
              ))}
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MainCard({ 
  progress = 68, 
  title = "PULAAR — FONDAMENTAL",
  completedText = "68% Complété",
  moduleText = "5/8 Modules"
}: { 
  progress?: number, 
  title?: string,
  completedText?: string,
  moduleText?: string
}) {
  return (
    <View className="bg-[#FAF9F6] p-4 rounded-xl border border-gray-200 shadow-sm">
      <Text className="text-gray-600 mb-1 text-sm font-medium">Progression Actuelle</Text>
      <Text className="text-base font-bold mb-3 text-gray-900 tracking-wide">{title}</Text>
      
      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', overflow: 'hidden', marginBottom: 8 }}>
        <View
          style={{
            width: `${progress}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#F59E0B',
          }}
        />
      </View>
      
      <View className="flex-row justify-between items-center">
        <Text className="text-xs text-gray-700 font-medium">{completedText}</Text>
        <Text className="text-xs text-gray-500">{moduleText}</Text>
      </View>
    </View>
  );
}

interface ModuleCardProps {
  title: string;
  description?: string;
  moduleName?: string;
  xp?: number;
  isLocked?: boolean;
  icon?: React.ReactNode;
  iconBgColor?: string;
  onPress?: () => void;
  lessonInfo?: string;
}

function ModuleCard({
  title, 
  description, 
  moduleName,
  xp, 
  isLocked = false,
  icon,
  iconBgColor = "bg-orange-50",
  onPress,
  lessonInfo
}: ModuleCardProps) {
  return (
    <Pressable 
      onPress={!isLocked ? onPress : undefined}
      className={`flex-row justify-between items-center bg-white p-4 rounded-2xl mb-3 border border-gray-200 ${isLocked ? 'opacity-80' : ''}`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View className="flex-row items-center flex-1">
        <View className={`${isLocked ? 'bg-gray-100 border border-gray-200' : iconBgColor} w-12 h-12 rounded-full items-center justify-center mr-4`}>
          {isLocked ? (
            <Feather name="lock" size={20} color="#9CA3AF" />
          ) : (
            icon || <Feather name="book" size={20} color="#92400E" />
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center mb-0.5">
            <Text className="text-[#002366] text-xs font-bold mr-2">{moduleName}</Text>
            {!isLocked && lessonInfo && (
              <Text className="text-green-600 text-xs font-medium">{lessonInfo}</Text>
            )}
          </View>
          <Text className="text-gray-900 font-bold text-[15px] mb-0.5" numberOfLines={1}>{title}</Text>
          {description && <Text className="text-gray-500 text-xs" numberOfLines={1}>{description}</Text>}
        </View>
      </View>
      {xp !== undefined && (
        <View className="ml-2 items-end">
          <Text className="text-[#F59E0B] text-xs font-bold">{xp} XP</Text>
        </View>
      )}
    </Pressable>
  );
}

interface QuickActionCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  bgColor: string;
  onPress: () => void;
}

function QuickActionCard({ title, subtitle, icon, bgColor, onPress }: QuickActionCardProps) {
  return (
    <Pressable 
      onPress={onPress}
      className={`w-[48%] ${bgColor} rounded-2xl p-4 mb-3`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View className="mb-2">
        {icon}
      </View>
      <Text className="font-bold text-gray-900 text-sm">{title}</Text>
      <Text className="text-gray-500 text-xs mt-0.5">{subtitle}</Text>
    </Pressable>
  );
}
