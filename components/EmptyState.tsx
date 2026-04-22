import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Aucune activité trouvée',
  message = 'Ce contenu n\'est pas disponible sur Moodle.',
  actionLabel = 'Retour au cours',
  onAction,
}) => {
  return (
    <View className="flex-1 items-center justify-center py-12 px-6">
      <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
        <Feather name="inbox" size={40} color="#D1D5DB" />
      </View>
      <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
        {title}
      </Text>
      <Text className="text-gray-500 text-center mb-6">
        {message}
      </Text>
      {onAction && (
        <Pressable
          onPress={onAction}
          className="bg-[#002366] rounded-full px-8 py-3"
        >
          <Text className="text-white font-bold">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
};

export default EmptyState;