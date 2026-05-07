import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native';
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
    <View style={styles.flex1_itemscenter_justifycente}>
      <View style={styles.w20_h20_roundedfull_bggray100_}>
        <Feather name="inbox" size={40} color="#D1D5DB" />
      </View>
      <Text style={styles.textxl_fontbold_textgray900_mb}>
        {title}
      </Text>
      <Text style={styles.textgray500_textcenter_mb6}>
        {message}
      </Text>
      {onAction && (
        <Pressable
          onPress={onAction}
          style={styles.bg002366_roundedfull_px8_py3}
        >
          <Text style={styles.textwhite_fontbold}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
};

export default EmptyState;

const styles = StyleSheet.create({
  bg002366_roundedfull_px8_py3: {
    backgroundColor: '#002366',
    borderRadius: 9999,
    paddingHorizontal: 32,
    paddingVertical: 12
  },
  flex1_itemscenter_justifycente: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48
  },
  textgray500_textcenter_mb6: {
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center'
  },
  textwhite_fontbold: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  textxl_fontbold_textgray900_mb: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  w20_h20_roundedfull_bggray100_: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 9999,
    height: 80,
    justifyContent: 'center',
    marginBottom: 16,
    width: 80
  },
});