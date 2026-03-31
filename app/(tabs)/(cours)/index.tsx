import { AntDesign, Feather, FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CoursScreen() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]" edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-5 py-4">
          
          <View className="bg-white rounded-3xl p-5 mb-8 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
            <View className="flex-row items-center">
              
              <View className="w-20 h-20 rounded-full border-4 border-[#F97316] items-center justify-center mr-5">
                <Text className="text-[#EA580C] font-black text-xl">60%</Text>
                <Text className="text-gray-400 text-[10px] font-bold mt-1">FAIT</Text>
              </View>

              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-[17px] mb-1">6 leçons complétées</Text>
                <Text className="text-gray-500 text-sm mb-3">4 leçons restantes</Text>
                <View className="flex-row items-center">
                  <Text className="text-orange-500 mr-1">🔥</Text>
                  <Text className="text-[#EA580C] font-semibold text-sm">Série de 7 jours — Continuez !</Text>
                </View>
              </View>

            </View>
          </View>

          <View className="flex-row items-center mb-5">
            <Text className="text-gray-900 font-bold text-lg mr-3">Module 1 — Salutations</Text>
            <View className="bg-orange-50 px-2 py-1 rounded-md flex-row items-center">
              <Text className="text-orange-600 font-bold text-xs mr-1">3/3</Text>
              <AntDesign name="check" size={10} color="#EA580C" />
            </View>
          </View>

          <ActivityCard 
            title="Les salutations de base"
            info="Audio • 8 min"
            icon={<Feather name="volume-2" size={24} color="#60A5FA" />}
            iconBg="bg-blue-50"
            status="checked"
            borderColor="border-green-500"
          />

          <ActivityCard 
            title="Vocabulaire des salutations"
            info="Lecture • 5 min"
            icon={<Ionicons name="book-outline" size={24} color="#60A5FA" />}
            iconBg="bg-blue-50"
            status="checked"
            borderColor="border-green-500"
          />

          <ActivityCard 
            title="Quiz — Module 1"
            info="? 10 questions • Score: 9/10"
            icon={<Feather name="edit-2" size={22} color="#F87171" />}
            iconBg="bg-green-50" // A bit different intentionally like mock? The mock uses light green icon background
            status="star"
            borderColor="border-green-500"
            onPress={() => router.push('/(quiz)/index')}
          />

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface ActivityCardProps {
  title: string;
  info: string;
  icon: React.ReactNode;
  iconBg: string;
  status: 'checked' | 'star' | 'none';
  borderColor: string;
  onPress?: () => void;
}

function ActivityCard({ title, info, icon, iconBg, status, borderColor, onPress }: ActivityCardProps) {
  return (
    <Pressable 
      onPress={onPress}
      className={`bg-white rounded-2xl p-4 mb-4 flex-row items-center justify-between border-l-4 ${borderColor} shadow-sm`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View className="flex-row items-center flex-1">
        <View className={`${iconBg} w-14 h-14 rounded-2xl items-center justify-center mr-4`}>
          {icon}
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 font-bold text-base mb-1">{title}</Text>
          <View className="flex-row items-center">
            {info.startsWith('?') ? null : <Feather name={info.includes('Audio') ? "music" : "file-text"} size={12} color="#9CA3AF" style={{marginRight: 4}} />}
            <Text className="text-gray-500 text-xs font-medium">{info}</Text>
          </View>
        </View>
      </View>

      <View className="ml-3">
        {status === 'checked' && (
          <View className="bg-green-500 rounded-md p-1">
            <AntDesign name="check" size={16} color="white" />
          </View>
        )}
        {status === 'star' && (
           <AntDesign name="star" size={22} color="#FBBF24" />
        )}
      </View>
    </Pressable>
  );
}
