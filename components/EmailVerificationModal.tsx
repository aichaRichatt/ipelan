import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface EmailVerificationModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  visible,
  email,
  onClose,
}) => {
  const openEmailApp = async () => {
    try {
      await Linking.openURL('mailto:');
    } catch {
      // Mail app not available on this device
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Feather name="mail" size={36} color="#002366" />
            </View>
          </View>

          <Text style={styles.title}>Vérifiez votre email</Text>

          <Text style={styles.message}>
            {'Un email de confirmation a été envoyé à\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          <Text style={styles.instructions}>
            Cliquez sur le lien dans l&apos;email pour activer votre compte avant de vous connecter.
          </Text>

          <View style={styles.buttonContainer}>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Se connecter</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.primaryButton]} onPress={openEmailApp}>
              <Feather name="external-link" size={15} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Gmail</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1e3a8a',
  },
  message: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  emailHighlight: {
    color: '#002366',
    fontWeight: '700',
  },
  instructions: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
  },
  primaryButton: {
    backgroundColor: '#002366',
  },
  secondaryButtonText: {
    color: '#4b5563',
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonIcon: {
    marginRight: 6,
  },
});
