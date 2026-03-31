import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Module {
  id: string;
  title: string;
  description: string;
  progress: number;
  lessonsCompleted: number;
  totalLessons: number;
  xp: number;
  icon: string;
  iconColor: string;
  iconBg: string;
}

interface LevelSection {
  id: number;
  title: string;
  subtitle: string;
  modules: Module[];
}

const LEVEL_SECTIONS: LevelSection[] = [
  {
    id: 1,
    title: "Niveau 1",
    subtitle: "Fondamental",
    modules: [
      {
        id: "1",
        title: "Salutations",
        description: "Apprends les salutations de base en Pulaar",
        progress: 100,
        lessonsCompleted: 3,
        totalLessons: 3,
        xp: 30,
        icon: "handshake",
        iconColor: "#10B981",
        iconBg: "bg-green-100",
      },
      {
        id: "2",
        title: "La famille",
        description: "Les membres de la famille en Pulaar",
        progress: 50,
        lessonsCompleted: 2,
        totalLessons: 4,
        xp: 25,
        icon: "users",
        iconColor: "#6366F1",
        iconBg: "bg-indigo-100",
      },
    ],
  },
  {
    id: 2,
    title: "Niveau 2",
    subtitle: "Intermédiaire",
    modules: [
      {
        id: "3",
        title: "Les nombres",
        description: "Apprendre à compter de 1 à 100",
        progress: 0,
        lessonsCompleted: 0,
        totalLessons: 6,
        xp: 40,
        icon: "hash",
        iconColor: "#F59E0B",
        iconBg: "bg-amber-100",
      },
      {
        id: "4",
        title: "Les couleurs",
        description: "Les couleurs en Pulaar",
        progress: 0,
        lessonsCompleted: 0,
        totalLessons: 5,
        xp: 25,
        icon: "droplet",
        iconColor: "#EC4899",
        iconBg: "bg-pink-100",
      },
    ],
  },
  {
    id: 3,
    title: "Niveau 3",
    subtitle: "Avancé",
    modules: [
      {
        id: "5",
        title: "Les aliments",
        description: "Vocabulaire de la nourriture",
        progress: 0,
        lessonsCompleted: 0,
        totalLessons: 8,
        xp: 50,
        icon: "coffee",
        iconColor: "#8B5CF6",
        iconBg: "bg-violet-100",
      },
      {
        id: "6",
        title: "Les animaux",
        description: "Les animaux domestiques et sauvages",
        progress: 0,
        lessonsCompleted: 0,
        totalLessons: 7,
        xp: 45,
        icon: "paw",
        iconColor: "#14B8A6",
        iconBg: "bg-teal-100",
      },
    ],
  },
];

const getIconName = (icon: string): string => {
  const iconMap: Record<string, string> = {
    handshake: "handshake",
    users: "people",
    hash: "hash",
    droplet: "water",
    coffee: "coffee",
    paw: "paw",
  };
  return iconMap[icon] || "book";
};

export default function CoursScreen() {
  const router = useRouter();

  const renderProgressBar = (progress: number) => {
    return (
      <View className="mt-3">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-xs text-gray-500">{progress}% complété</Text>
          <Text className="text-xs text-gray-400">
            {Math.round((progress / 100) * 4)}/{4} leçons
          </Text>
        </View>
        <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: progress === 100 ? '#10B981' : '#4a90e2',
            }}
          />
        </View>
      </View>
    );
  };

  const renderModuleCard = (module: Module) => {
    const isCompleted = module.progress === 100;

    return (
      <Pressable
        key={module.id}
        onPress={() => {
          if (isCompleted) {
            router.push("/(stacks)/(cours)/result" as any);
          } else {
            router.push(`/(stacks)/(cours)/${module.id}` as any);
          }
        }}
        className="bg-white rounded-2xl p-4 mb-3 border border-gray-100"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View className="flex-row items-start">
          <View
            className={`${module.iconBg} w-14 h-14 rounded-2xl items-center justify-center mr-4`}
          >
            <Feather name={getIconName(module.icon) as any} size={24} color={module.iconColor} />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-gray-900 font-bold text-base flex-1">
                {module.title}
              </Text>
              {isCompleted ? (
                <View className="bg-green-100 rounded-full px-2 py-1 flex-row items-center">
                  <AntDesign name="check" size={12} color="#10B981" />
                  <Text className="text-green-600 text-xs font-medium ml-1">Terminé</Text>
                </View>
              ) : (
                <View className="bg-amber-100 rounded-full px-2 py-1">
                  <Text className="text-amber-600 text-xs font-medium">
                    +{module.xp} XP
                  </Text>
                </View>
              )}
            </View>

            <Text className="text-gray-500 text-sm mb-1" numberOfLines={2}>
              {module.description}
            </Text>

            {renderProgressBar(module.progress)}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderLevelSection = (section: LevelSection) => {
    const completedModules = section.modules.filter(m => m.progress === 100).length;
    const sectionProgress = Math.round((completedModules / section.modules.length) * 100);

    return (
      <View key={section.id} className="mb-6">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-xl bg-[#002366] items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">{section.id}</Text>
            </View>
            <View>
              <Text className="text-gray-900 font-bold text-lg">{section.title}</Text>
              <Text className="text-gray-400 text-xs">{section.subtitle}</Text>
            </View>
          </View>
          <View className="bg-gray-100 rounded-full px-3 py-1">
            <Text className="text-gray-600 text-xs font-medium">
              {completedModules}/{section.modules.length}
            </Text>
          </View>
        </View>

        <View className="pl-1">
          {section.modules.map(renderModuleCard)}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={["top", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-5 pt-4">
          <Text className="text-gray-900 font-bold text-2xl mb-1">Mes Cours</Text>
          <Text className="text-gray-500 text-sm mb-6">
            Continue ton apprentissage des langues
          </Text>
        </View>

        <View className="px-5">
          {LEVEL_SECTIONS.map(renderLevelSection)}
        </View>

        <View className="px-5 mt-4">
          <Pressable
            onPress={() => router.push("/(quiz)/index" as any)}
            className="bg-gradient-to-r from-[#002366] to-[#4a90e2] rounded-2xl p-5 flex-row items-center"
            style={{
              shadowColor: "#002366",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center mr-4">
              <Feather name="edit-2" size={24} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-lg">Quiz rapide</Text>
              <Text className="text-white/80 text-sm">Teste tes connaissances</Text>
            </View>
            <View className="bg-white/20 rounded-full px-3 py-1">
              <Text className="text-white text-xs font-medium">5 questions</Text>
            </View>
          </Pressable>
        </View>

        <View className="px-5 mt-6 mb-4">
          <Text className="text-gray-900 font-bold text-lg mb-4">Activités récentes</Text>

          <View className="flex-row -mx-1">
            <Pressable
              onPress={() => router.push("/(stacks)/(cours)/listening" as any)}
              className="flex-1 bg-blue-50 rounded-2xl p-4 m-1 items-center"
            >
              <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mb-2">
                <Feather name="headphones" size={20} color="#4a90e2" />
              </View>
              <Text className="text-gray-800 font-medium text-xs">Oral</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(stacks)/(cours)/dictation" as any)}
              className="flex-1 bg-amber-50 rounded-2xl p-4 m-1 items-center"
            >
              <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center mb-2">
                <Feather name="edit" size={20} color="#F59E0B" />
              </View>
              <Text className="text-gray-800 font-medium text-xs">Dictée</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(stacks)/(cours)/association" as any)}
              className="flex-1 bg-purple-50 rounded-2xl p-4 m-1 items-center"
            >
              <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center mb-2">
                <Feather name="link" size={20} color="#9333EA" />
              </View>
              <Text className="text-gray-800 font-medium text-xs">Association</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(stacks)/(cours)/game" as any)}
              className="flex-1 bg-green-50 rounded-2xl p-4 m-1 items-center"
            >
              <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mb-2">
                <Feather name="shuffle" size={20} color="#10B981" />
              </View>
              <Text className="text-gray-800 font-medium text-xs">Ordre</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
