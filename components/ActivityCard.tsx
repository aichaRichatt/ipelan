import { ActivityWithProgress } from '@/types/activity';
import { ActivityType } from '@/utils/xpCalculator';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ActivityCardProps {
  activity: ActivityWithProgress;
  onPress: () => void;
  isOfflineCached?: boolean;
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
  isOfflineCached = false,
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
      style={[styles.card, isCompleted && styles.cardCompleted]}
    >
      <View style={styles.row}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Feather name={icon as any} size={24} color={color} />
        </View>
        
        <View style={styles.flex1}>
          <View style={styles.row}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>Terminé</Text>
              </View>
            )}
          </View>
          
          <View style={[styles.row, { marginTop: 4 }]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{label}</Text>
            </View>
            <View style={styles.xpContainer}>
              <Feather name="star" size={12} color="#F59E0B" />
              <Text style={styles.xpText}>{xp} XP</Text>
            </View>
            {scoreDisplay && (
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>★ {scoreDisplay}</Text>
              </View>
            )}
            {isOfflineCached && (
              <View style={styles.offlineBadge}>
                <Feather name="download" size={10} color="#1D4ED8" />
                <Text style={styles.offlineText}>Hors-ligne</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.rightSection}>
          {mastery ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.masteryEmoji}>{mastery.emoji}</Text>
              <Text style={[styles.masteryLabel, { color: mastery.color }]}>
                {mastery.label}
              </Text>
              <Text style={styles.masteryPercent}>{scorePercent}%</Text>
            </View>
          ) : (
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          )}
        </View>
      </View>
      
      {progress && progress.totalScore > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progression</Text>
            <Text style={styles.progressValue}>{progress.bestScore}/{progress.totalScore}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${scorePercent}%`, backgroundColor: color }]}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
};

export default ActivityCard;

const styles = StyleSheet.create({
  // Card container
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  // Layout
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
    marginLeft: 12,
  },
  // Icon
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Text
  title: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 16,
    flex: 1,
  },
  badge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#4B5563',
    fontSize: 12,
  },
  xpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  xpText: {
    color: '#A16207',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  scoreBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scoreText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '500',
  },
  // Right side
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  masteryEmoji: {
    fontSize: 18,
  },
  masteryLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  masteryPercent: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  // Progress section
  progressSection: {
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 12,
    paddingTop: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  progressValue: {
    color: '#6B7280',
    fontSize: 12,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Offline badge
  offlineBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  offlineText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '500',
  },
  // Completed badge
  completedBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 9999,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  completedText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '500',
  },
});