import { FilterTab } from '@/types/activity';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
    <View style={styles.bgwhite_borderb_bordergray200}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key] || 0;
          const color = getTabColor(tab.key);
          
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              style={[
                styles.tabBase,
                isActive ? styles.tabActive : styles.tabInactive,
              ]}
            >
              <View style={styles.flexrow_itemscenter}>
                <Text
                  style={[
                    styles.tabTextBase,
                    isActive ? styles.tabTextActive : styles.tabTextInactive,
                  ]}
                >
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.countBadgeBase,
                      isActive ? styles.countBadgeActive : styles.countBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countTextBase,
                        isActive ? styles.countTextActive : styles.countTextInactive,
                      ]}
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

const styles = StyleSheet.create({
  bgwhite_borderb_bordergray200: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB'
  },
  flexrow_itemscenter: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // Tab styles
  tabBase: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 9999,
  },
  tabActive: {
    backgroundColor: '#002366',
  },
  tabInactive: {
    backgroundColor: '#F3F4F6',
  },
  // Text styles
  tabTextBase: {
    fontWeight: '500',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#6B7280',
  },
  // Count badge styles
  countBadgeBase: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  countBadgeInactive: {
    backgroundColor: '#E5E7EB',
  },
  countTextBase: {
    fontSize: 12,
    fontWeight: '700',
  },
  countTextActive: {
    color: '#FFFFFF',
  },
  countTextInactive: {
    color: '#6B7280',
  },
});