import React from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { ActivityType } from '@/utils/xpCalculator';
import { FilterTab } from '@/types/activity';

interface ActivityTabsProps {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  counts: Record<FilterTab, number>;
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'dictation', label: 'Dictée' },
  { key: 'listening', label: 'Listening' },
  { key: 'association', label: 'Association' },
  { key: 'wordOrder', label: 'Ordre' },
];

const getTabColor = (tab: FilterTab): string => {
  switch (tab) {
    case 'quiz': return '#4a90e2';
    case 'dictation': return '#10B981';
    case 'listening': return '#F59E0B';
    case 'association': return '#8B5CF6';
    case 'wordOrder': return '#EC4899';
    default: return '#002366';
  }
};

export const ActivityTabs: React.FC<ActivityTabsProps> = ({
  activeTab,
  onTabChange,
  counts,
}) => {
  return (
    <View className="bg-white border-b border-gray-200">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle="px-4 py-2"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key] || 0;
          const color = getTabColor(tab.key);
          
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              className={`px-4 py-2 mr-2 rounded-full ${
                isActive ? 'bg-[#002366]' : 'bg-gray-100'
              }`}
            >
              <View className="flex-row items-center">
                <Text
                  className={`font-medium text-sm ${
                    isActive ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View
                    className={`ml-2 px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20' : 'bg-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isActive ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default ActivityTabs;