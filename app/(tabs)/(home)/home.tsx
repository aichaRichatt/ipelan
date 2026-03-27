import { AntDesign } from "@expo/vector-icons";
import React, { ReactNode, useEffect, useState, useMemo } from "react";
import { Pressable, Text, View, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLogin } from "../../../hooks/useLogin";
import { useCourses } from "../../../hooks/useCourses";
import { useRouter } from "expo-router";

export default function Index() {
  const { user: loggedUser, token } = useLogin();
  const { courses, isLoading, fetchCourses, getCoursesByLevel } = useCourses();
  const router = useRouter();
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  
  useEffect(() => {
    if (!token) router.replace("/(auth)/login");
    fetchCourses();
  }, [token, router]);

  const levels = useMemo(() => {
    return Array.from(new Set(courses.map(c => c.categoryid))).map(id => ({
      id,
      name: id === 1 ? 'Fondamental' : id === 2 ? 'Intermédiaire' : id === 3 ? 'Avancé' : `Niveau ${id}`
    }));
  }, [courses]);

  useEffect(() => {
    if (levels.length > 0 && selectedLevelId === null) {
      setSelectedLevelId(levels[0].id);
    }
  }, [levels]);

  const displayedCourses = useMemo(() => {
    return selectedLevelId !== null ? getCoursesByLevel(selectedLevelId) : courses;
  }, [selectedLevelId, courses, getCoursesByLevel]);

  return (  
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 py-2">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-gray-500 text-sm">Bienvenue Home</Text>
            <Text className="text-xl font-bold text-gray-800">{loggedUser?.firstname}</Text>
          </View>
          <View className="flex-row items-center bg-gray-100 p-2 rounded-full px-4">
            <Text className="font-bold mr-1">{loggedUser?.coins}</Text>
            <Text>🪙</Text>
            <Pressable onPress={() => {}} className="ml-3">
              <AntDesign name="setting" size={20} color="#4b5563" />
            </Pressable>
          </View>
        </View>

        <MainCar />

        <View className="mt-6">
          <Text className="text-lg font-bold mb-3">Mes Niveaux</Text>
          <View className="flex-row mb-4">
            {levels.map(level => (
              <Pressable 
                key={level.id} 
                onPress={() => setSelectedLevelId(level.id)}
                className={`mr-2 px-4 py-2 rounded-full ${selectedLevelId === level.id ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <Text className={selectedLevelId === level.id ? 'text-white' : 'text-gray-700'}>
                  {level.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-lg font-bold mb-3">Cours disponibles</Text>
          {displayedCourses.length === 0 ? (
            <View className="bg-gray-50 p-10 rounded-xl items-center">
              <Text className="text-gray-400">Aucun cours trouvé pour ce niveau.</Text>
            </View>
          ) : (
            displayedCourses.map(course => (
              <GlobalSectionsCard 
                key={course.id}
                title={course.fullname}
                description={course.summary ? course.summary.replace(/<[^>]*>/g, '') : "Apprendre le " + course.shortname}
                icon={<AntDesign name="book" size={24} color="#3b82f6" />}
                xp={100}
                onPress={() => console.log("Navigate to course", course.id)}
              />
            ))
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function MainCar({ progress = 64, title = "Pullar" }: { progress?: number, title?: string }) {
  return (
    <View className="flex">
      <Text className="text-gray-500 mb-1">Progression actuelle</Text>
      <Text className="text-lg font-bold mb-2">{title}</Text>
       
      <PercentageBar
        height={19}
        backgroundColor={'#e5e7eb'}
        completedColor={'#3b82f6'}
        percentage={progress}
      />
      <View className="border-t-gray-200 border w-full mt-4" />
    </View>
  );
}

const PercentageBar = ({
  percentage,
  height,
  backgroundColor,
  completedColor,
}:{
  percentage: number;
  height: number;
  backgroundColor: string;
  completedColor: string;
}) => {
  return (
    <View>
      <View style={{justifyContent: 'center'}}>
        <View
          style={{
            width: '100%',
            height: height,
            marginVertical: 10,
            borderRadius: 5,
            backgroundColor: backgroundColor,
          }}
        />
        <View
          style={{
            width: percentage ? `${percentage}%` : "0%",
            height: height,
            marginVertical: 10,
            borderRadius: 5,
            backgroundColor: completedColor,
            position: 'absolute',
            top: 0
          }}
        />
        <View
          style={{
            width: percentage ? `${percentage}%` : "0%",
            height: height,
            marginTop: 5
          }}>
          <Text style={{textAlign: 'right', fontSize: 12, fontWeight: 'bold'}}>{percentage}%</Text>
        </View>
      </View>
    </View>
  );
};

interface GlobalSectionsCardProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  image?: string;
  xp?: number;
  onPress?: () => void;
}

function GlobalSectionsCard({title, description, icon, image, xp, onPress}: GlobalSectionsCardProps) {
  return (
    <Pressable 
      onPress={onPress}
      className="flex-row justify-between items-center bg-gray-50 p-4 rounded-xl mb-3 border border-gray-100"
    >
      <View className="flex-row items-center flex-1">
        <View className="bg-blue-100 p-3 rounded-lg mr-4">
          {image ? <Image source={{ uri: image }} className="w-6 h-6" /> : icon}
        </View>
        <View className="flex-1">
          <Text className="text-gray-800 font-bold text-lg" numberOfLines={1}>{title}</Text>
          {description && <Text className="text-gray-500 text-sm" numberOfLines={2}>{description}</Text>}
        </View>
      </View>
      {xp && (
        <View className="ml-2 bg-yellow-100 px-3 py-1 rounded-full">
          <Text className="text-yellow-700 font-bold text-xs">{xp} XP</Text>
        </View>
      )}
    </Pressable>
  );
}