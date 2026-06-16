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
  { key: 'listening', label: 'Écoute' },
  { key: 'association', label: 'Association' },
  { key: 'wordOrder', label: 'Ordre' },
];

export const ActivityTabs: React.FC<ActivityTabsProps> = ({
  activeTab,
  onTabChange,
  counts,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key] || 0;
          
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              style={[
                styles.tab,
                isActive ? styles.tabActive : styles.tabInactive,
              ]}
            >
              <View style={styles.tabContent}>
                <Text
                  style={[
                    styles.tabText,
                    isActive ? styles.tabTextActive : styles.tabTextInactive,
                  ]}
                >
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      isActive ? styles.countBadgeActive : styles.countBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
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
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 12,
    minWidth: 70,
  },
  tabActive: {
    backgroundColor: '#002366',
  },
  tabInactive: {
    backgroundColor: '#F3F4F6',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#6B7280',
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  countBadgeInactive: {
    backgroundColor: '#E5E7EB',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
  countTextActive: {
    color: '#FFFFFF',
  },
  countTextInactive: {
    color: '#6B7280',
  },
});