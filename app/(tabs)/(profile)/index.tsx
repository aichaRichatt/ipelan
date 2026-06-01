import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLogin } from "../../../hooks/useLogin";
import { useUserStats } from "../../../hooks/useUserStats";
import { getLevelFromXP } from "../../../utils/levelCalculator";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DefaultProfileImage = require('../../../assets/images/defaultprofile.png');

const PREFERENCES_KEY = '@ipelan_preferences';

const LANG_LABELS: Record<string, string> = {
  pulaar: 'Pulaar',
  soninke: 'Soninké',
  soninké: 'Soninké',
  wolof: 'Wolof',
};

export default function ProfileScreen() {
  const { user, logoutUser } = useLogin();
  const router = useRouter();
  const { stats, refetch } = useUserStats();
  const [avatarError, setAvatarError] = useState(false);
  const [language, setLanguage] = useState<string | null>(null);

  const xp = stats.xp || user?.ipelan_xp || 0;
  const levelInfo = getLevelFromXP(xp);
  const isMaxLevel = levelInfo.progress === 100 && levelInfo.level === 6;
  const xpToNext = isMaxLevel ? 0 : levelInfo.maxXP - xp;

  useFocusEffect(
    useCallback(() => {
      refetch();
      AsyncStorage.getItem(PREFERENCES_KEY)
        .then(raw => {
          if (raw) {
            try { setLanguage(JSON.parse(raw)?.language ?? null); } catch { /* ignore */ }
          }
        })
        .catch(() => {});
    }, [refetch, user?.id])
  );

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Se déconnecter", style: "destructive", onPress: () => logoutUser() },
      ]
    );
  };

  const displayName = [user?.firstname, user?.lastname].filter(Boolean).join(' ') || user?.username || 'Utilisateur';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
 

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <View style={s.profileCard}>
          {/* Avatar */}
          <View style={s.avatarWrapper}>
            <Image
              source={(!avatarError && user?.avatar) ? { uri: user.avatar } : DefaultProfileImage}
              defaultSource={DefaultProfileImage}
              style={s.avatar}
              onError={() => setAvatarError(true)}
            />
            <Pressable
              style={s.avatarEditBtn}
              onPress={() => router.push('/(settings)/edit-profile' as any)}
            >
              <Feather name="camera" size={12} color="white" />
            </Pressable>
          </View>

          <Text style={s.profileName}>{displayName}</Text>
          {user?.email ? (
            <Text style={s.profileEmail}>{user.email}</Text>
          ) : null}

          {/* Chips langue + niveau */}
          <View style={s.chipsRow}>
            {language ? (
              <View style={s.chip}>
                <Ionicons name="language" size={12} color="#002366" />
                <Text style={s.chipText}>{LANG_LABELS[language] ?? language}</Text>
              </View>
            ) : null}
            <View style={[s.chip, s.chipLevel]}>
              <Ionicons name="trophy" size={12} color="#F59E0B" />
              <Text style={[s.chipText, { color: '#92400E' }]}>{levelInfo.title}</Text>
            </View>
          </View>

          {/* Barre XP */}
          <View style={s.xpBarSection}>
            <View style={s.xpBarLabelRow}>
              <Text style={s.xpBarLabel}>Niveau {levelInfo.level}</Text>
              {isMaxLevel
                ? <Text style={s.xpBarLabel}>Niveau max ✓</Text>
                : <Text style={s.xpBarLabel}>{xpToNext} XP pour Nv.{levelInfo.level + 1}</Text>
              }
            </View>
            <View style={s.xpBarBg}>
              <View style={[s.xpBarFill, { width: `${levelInfo.progress}%` as any }]} />
            </View>
            <Text style={s.xpTotal}>{xp} XP au total</Text>
          </View>
        </View>

        {/* ── Grille 2×2 stats ──────────────────────────── */}
        <View style={s.statsGrid}>
          <StatCard
            icon={<Ionicons name="flame" size={26} color="#EF4444" />}
            value={String(stats.streak || user?.streak || 0)}
            label="SÉRIE"
            bg="#FEF2F2"
          />
          <StatCard
            icon={<Feather name="heart" size={26} color="#EC4899" />}
            value={String(stats.lives ?? 6)}
            label="VIES"
            bg="#FDF2F8"
          />
          <StatCard
            icon={<Ionicons name="medal" size={26} color="#8B5CF6" />}
            value={String(stats.badges)}
            label="BADGES"
            bg="#F5F3FF"
          />
          <StatCard
            icon={<Feather name="dollar-sign" size={26} color="#10B981" />}
            value={String(stats.coins || 0)}
            label="PIÈCES"
            bg="#F0FDF4"
          />
        </View>

        {/* ── Cours stats ───────────────────────────────── */}
        <View style={s.courseStatsRow}>
          <View style={s.courseStatItem}>
            <Text style={s.courseStatValue}>{stats.coursesInProgress}</Text>
            <Text style={s.courseStatLabel}>En cours</Text>
          </View>
          <View style={s.courseStatDivider} />
          <View style={s.courseStatItem}>
            <Text style={s.courseStatValue}>{stats.coursesCompleted}</Text>
            <Text style={s.courseStatLabel}>Terminés</Text>
          </View>
        </View>

        {/* ── Actions ───────────────────────────────────── */}
        <View style={s.actions}>
          <ActionRow
            icon="user"
            label="Modifier le profil"
            onPress={() => router.push('/(settings)/edit-profile' as any)}
          />
          <ActionRow
            icon="settings"
            label="Paramètres"
            onPress={() => router.push('/(settings)' as any)}
          />
        </View>

        <Pressable onPress={handleLogout} style={s.logoutBtn}>
          <Feather name="log-out" size={16} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={s.logoutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Composants internes ────────────────────────────────────────────────────

function StatCard({ icon, value, label, bg }: { icon: React.ReactNode; value: string; label: string; bg: string }) {
  return (
    <View style={[s.statCard, { backgroundColor: bg }]}>
      {icon}
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function ActionRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={s.actionRow} onPress={onPress}>
      <View style={s.actionIcon}>
        <Feather name={icon as any} size={18} color="#002366" />
      </View>
      <Text style={s.actionLabel}>{label}</Text>
      <Feather name="chevron-right" size={18} color="#9CA3AF" />
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },

  // Header
  header: {
    backgroundColor: '#002366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },

  scroll: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 20 },

  // Carte profil
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#002366' },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#002366',
    borderRadius: 12,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#6B7280', marginBottom: 12 },

  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  chipLevel: { backgroundColor: '#FFFBEB' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#002366' },

  // Barre XP
  xpBarSection: { width: '100%' },
  xpBarLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpBarLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  xpBarBg: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 99, overflow: 'hidden', marginBottom: 6 },
  xpBarFill: { height: '100%', backgroundColor: '#002366', borderRadius: 99 },
  xpTotal: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },

  // Grille stats 2×2
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47.5%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Cours stats
  courseStatsRow: {
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, elevation: 1,
  },
  courseStatItem: { flex: 1, alignItems: 'center' },
  courseStatValue: { fontSize: 24, fontWeight: '800', color: '#002366' },
  courseStatLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  courseStatDivider: { width: 1, height: 40, backgroundColor: '#E5E7EB' },

  // Actions
  actions: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, elevation: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },

  // Déconnexion
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
});
