import { ActivityWithProgress } from '@/types/activity';
import { ActivityType } from '@/utils/xpCalculator';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
      style={[styles.bgwhite_rounded2xl_p4_mb3_bord,{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }]}
      
    >
      <View style={styles.style_4}>
        <View
          style={[styles.w12_h12_roundedxl_itemscenter_ ,{ backgroundColor: `${color}15` }]}
         >
          <Feather name={icon as any} size={24} color={color} />
        </View>
        
        <View style={styles.flex1_ml3}>
          <View style={styles.flexrow_itemscenter}>
            <Text style={styles.textgray900_fontsemibold_flex1} numberOfLines={1}>
              {title}
            </Text>
            {isCompleted && (
              <View style={styles.style_3}>
                <Text style={styles.style_2}>Terminé</Text>
              </View>
            )}
          </View>
          
          <View style={styles.flexrow_itemscenter_mt1}>
            <View style={styles.bggray100_px2_py05_roundedmd}>
              <Text style={styles.textgray600_textxs}>{label}</Text>
            </View>
            <View style={styles.flexrow_itemscenter_ml2}>
              <Feather name="star" size={12} color="#F59E0B" />
              <Text style={styles.textyellow700_textxs_fontmediu}>{xp} XP</Text>
            </View>
            {scoreDisplay && (
        <View style={styles.ml2_bggreen100_px2_py05_rounde}>
          <Text style={styles.textgreen700_textxs_fontmedium}>★ {scoreDisplay}</Text>
        </View>
      )}
          </View>
        </View>
        
        <View style={styles.itemsend}>
          {mastery ? (
            <View style={styles.itemscenter}>
              <Text style={styles.textlg}>{mastery.emoji}</Text>
              <Text style={[styles.textxs_fontmedium,{ color: mastery.color }]} >
                {mastery.label}
              </Text>
              <Text style={styles.textgray400_textxs}>{scorePercent}%</Text>
            </View>
          ) : (
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          )}
        </View>
      </View>
      
      {progress && progress.totalScore > 0 && (
        <View style={styles.mt3_pt3_bordert_bordergray100}>
          <View style={styles.flexrow_itemscenter_justifybet}>
            <Text style={styles.style_1}>Progression</Text>
            <Text style={styles.textgray500_textxs}>{progress.bestScore}/{progress.totalScore}</Text>
          </View>
          <View style={styles.h15_bggray100_roundedfull_over}>
            <View
              style={[styles.hfull_roundedfull,{ width: `${scorePercent}%`, backgroundColor: color }]}
             />
          </View>
        </View>
      )}
    </Pressable>
  );
};

export default ActivityCard;

const styles = StyleSheet.create({
  bggray100_px2_py05_roundedmd: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8
  },
  bgwhite_rounded2xl_p4_mb3_bord: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16
  },
  flex1_ml3: {
    flex: 1,
    marginLeft: 12
  },
  flexrow_itemscenter: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  flexrow_itemscenter_justifybet: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  flexrow_itemscenter_ml2: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 8
  },
  flexrow_itemscenter_mt1: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4
  },
  h15_bggray100_roundedfull_over: {
    backgroundColor: '#F3F4F6',
    borderRadius: 9999,
    overflow: 'hidden'
  },
  hfull_roundedfull: {
    borderRadius: 9999,
    height: '100%'
  },
  itemscenter: {
    alignItems: 'center'
  },
  itemsend: {
    alignItems: 'flex-end'
  },
  ml2_bggreen100_px2_py05_rounde: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    marginLeft: 8,
    paddingHorizontal: 8
  },
  mt3_pt3_bordert_bordergray100: {
    borderColor: '#F3F4F6',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12
  },
  style_1: {
    color: '#6B7280',
    fontSize: 12
  },
  style_2: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '500'
  },
  style_3: {
    backgroundColor: '#DCFCE7',
    borderRadius: 9999,
    marginLeft: 8,
    paddingHorizontal: 8
  },
  style_4: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  textgray400_textxs: {
    color: '#9CA3AF',
    fontSize: 12
  },
  textgray500_textxs: {
    color: '#6B7280',
    fontSize: 12
  },
  textgray600_textxs: {
    color: '#4B5563',
    fontSize: 12
  },
  textgray900_fontsemibold_flex1: {
    color: '#111827',
    flex: 1,
    fontWeight: '600'
  },
  textgreen700_textxs_fontmedium: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '500'
  },
  textlg: {
    fontSize: 18
  },
  textxs_fontmedium: {
    fontSize: 12,
    fontWeight: '500'
  },
  textyellow700_textxs_fontmediu: {
    color: '#A16207',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4
  },
  w12_h12_roundedxl_itemscenter_: {
    alignItems: 'center',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
});