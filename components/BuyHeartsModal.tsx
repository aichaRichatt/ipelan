import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface BuyHeartsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onBuy: () => void;
  lives: number;
  coins: number;
  nextHeartTime: string | null;
  cost?: number;
}

const { width, height } = Dimensions.get('window');

export const BuyHeartsModal: React.FC<BuyHeartsModalProps> = ({
  isVisible,
  onClose,
  onBuy,
  lives,
  coins,
  nextHeartTime,
  cost = 20
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const canBuy = coins >= cost;

  useEffect(() => {
    if (!nextHeartTime || lives >= 6) return;

    const updateTimer = () => {
      const next = new Date(nextHeartTime).getTime();
      const now = new Date().getTime();
      const diff = next - now;

      if (diff <= 0) {
        setTimeLeft('Prêt !');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [nextHeartTime, lives]);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.heartContainer}>
              <FontAwesome5 name="heart" size={40} color="#EF4444" solid />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{lives}</Text>
              </View>
            </View>
            <Text style={styles.title}>Plus de cœurs !</Text>
            <Text style={styles.subtitle}>
              Vous avez besoin d'au moins 1 cœur pour commencer une activité.
            </Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Votre solde</Text>
              <View style={styles.style_1}>
                <Text style={styles.statValue}>{coins}</Text>
                <Text style={styles.coinIcon}> 🪙</Text>
              </View>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#E5E7EB' }]}>
              <Text style={styles.statLabel}>Prix du cœur</Text>
              <View style={styles.flexrow_itemscenter}>
                <Text style={styles.statValue}>{cost}</Text>
                <Text style={styles.coinIcon}> 🪙</Text>
              </View>
            </View>
          </View>

          {/* Regeneration Info */}
          <View style={styles.infoBox}>
            <Ionicons name="time-outline" size={20} color="#4B5563" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Régénération gratuite</Text>
              <Text style={styles.infoSubtitle}>1 cœur toutes les 6 heures</Text>
              {lives < 6 && (
                <Text style={styles.timerText}>Prochain cœur dans : <Text style={styles.timerBold}>{timeLeft}</Text></Text>
              )}
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={onBuy}
              disabled={!canBuy}
              style={[styles.buyButton, !canBuy && styles.disabledButton]}
            >
              <Text style={styles.buyButtonText}>Acheter 1 Cœur</Text>
              {!canBuy && <Text style={styles.insufficientText}>Pièces insuffisantes</Text>}
            </Pressable>

            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Attendre</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heartContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -10,
    top: -10,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  coinIcon: {
    fontSize: 18,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    width: '100%',
    alignItems: 'center',
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  infoSubtitle: {
    fontSize: 13,
    color: '#3B82F6',
  },
  timerText: {
    fontSize: 12,
    color: '#1E40AF',
    marginTop: 4,
  },
  timerBold: {
    fontWeight: 'bold',
  },
  buttonContainer: {
    width: '100%',
  },
  buyButton: {
    backgroundColor: '#002366',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buyButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  insufficientText: {
    color: '#FEE2E2',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },

  flexrow_itemscenter: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  style_1: {
    alignItems: 'center',
    flexDirection: 'row'
  },
});