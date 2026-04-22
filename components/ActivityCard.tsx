import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ActivityWithProgress } from '@/types/activity';
import { ActivityType } from '@/utils/xpCalculator';

interface ActivityCardProps {
  activity: ActivityWithProgress;
  onPress: () => void;
}

const getTypeIcon = (type: ActivityType): string => {
  switch (type) {
    case 'quiz': return 'help-circle';
    case 'dictation': return 'edit-3';
    case 'listening': return 'headphones';
    case 'association': return 'link';
    case 'wordOrder': return 'shuffle';
    default: return 'file-text';
  }
};

const getTypeColor = (type: ActivityType): string => {
  switch (type) {
    case 'quiz': return '#4a90e2';
    case 'dictation': return '#10B981';
    case 'listening': return '#F59E0B';
    case 'association': return '#8B5CF6';
    case 'wordOrder': return '#EC4899';
    default: return '#6B7280';
  }
};

const getTypeLabel = (type: ActivityType): string => {
  switch (type) {
    case 'quiz': return 'Quiz';
    case 'dictation': return 'Dictée';
    case 'listening': return 'Listening';
    case 'association': return 'Association';
    case 'wordOrder': return 'Ordre';
    default: return 'Activité';
  }
};

const getMasteryBadge = (scorePercent: number): { emoji: string; label: string; color: string } | null => {
  if (scorePercent >= 90) return { emoji: '🏆', label: 'Maître', color: '#10B981' };
  if (scorePercent >= 70) return { emoji: '⭐', label: 'Avancé', color: '#4a90e2' };
  if (scorePercent >= 50) return { emoji: '🔄', label: 'Intermédiaire', color: '#F59E0B' };
  if (scorePercent > 0) return { emoji: '📚', label: 'Débutant', color: '#6B7280' };
  return null;
};

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  onPress,
}) => {
  const { title, type, xp, progress } = activity;
  const color = getTypeColor(type);
  const icon = getTypeIcon(type);
  const label = getTypeLabel(type);
  
  const isCompleted = progress?.isCompleted || false;
  const scorePercent = progress && progress.totalScore > 0 
    ? Math.round((progress.bestScore / progress.totalScore) * 100) 
    : 0;
  const scoreDisplay = progress && progress.totalScore > 0
    ? `${progress.bestScore}/${progress.totalScore}`
    : null;
  
  const mastery = getMasteryBadge(scorePercent);

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl p-4 mb-3 border border-gray-200"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="w-12 h-12 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Feather name={icon as any} size={24} color={color} />
        </View>
        
        <View className="flex-1 ml-3">
          <View className="flex-row items-center">
            <Text className="text-gray-900 font-semibold flex-1" numberOfLines={1}>
              {title}
            </Text>
            {isCompleted && (
              <View className="ml-2 bg-green-100 px-2 py-0.5 rounded-full">
                <Text className="text-green-700 text-xs font-medium">Terminé</Text>
              </View>
            )}
          </View>
          
          <View className="flex-row items-center mt-1">
            <View className="bg-gray-100 px-2 py-0.5 rounded-md">
              <Text className="text-gray-600 text-xs">{label}</Text>
            </View>
            <View className="flex-row items-center ml-2">
              <Feather name="star" size={12} color="#F59E0B" />
              <Text className="text-yellow-700 text-xs font-medium ml-1">{xp} XP</Text>
            </View>
            {scoreDisplay && (
        <View className="ml-2 bg-green-100 px-2 py-0.5 rounded-md">
          <Text className="text-green-700 text-xs font-medium">★ {scoreDisplay}</Text>
        </View>
      )}
          </View>
        </View>
        
        <View className="items-end">
          {mastery ? (
            <View className="items-center">
              <Text className="text-lg">{mastery.emoji}</Text>
              <Text className="text-xs font-medium" style={{ color: mastery.color }}>
                {mastery.label}
              </Text>
              <Text className="text-gray-400 text-xs">{scorePercent}%</Text>
            </View>
          ) : (
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          )}
        </View>
      </View>
      
      {progress && progress.totalScore > 0 && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-gray-500 text-xs">Progression</Text>
            <Text className="text-gray-500 text-xs">{progress.bestScore}/{progress.totalScore}</Text>
          </View>
          <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${scorePercent}%`, backgroundColor: color }}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
};

export default ActivityCard;