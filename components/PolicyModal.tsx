import React from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';

interface PolicyModalProps {
  visible: boolean;
  onAccept: () => void;
  onClose: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ visible, onAccept, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Conditions d&apos;utilisation</Text>
          <ScrollView style={styles.scrollView}>
            <Text style={styles.policyText}>
              En utilisant l&apos;application Ipelan et en accédant aux contenus de Moodle Richatt, vous acceptez d&apos;être inscrit aux cours correspondants et de partager vos informations de profil (nom, prénom, email) avec la plateforme. {"\n\n"}
              Ces données sont utilisées uniquement pour le suivi de votre progression pédagogique et la gestion de vos récompenses (coins, streak, xp). {"\n\n"}
              Vous acceptez également de respecter les règles de conduite de la plateforme Moodle.
            </Text>
          </ScrollView>
          <View style={styles.buttonContainer}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.acceptButton]} onPress={onAccept}>
              <Text style={styles.acceptButtonText}>Accepter</Text>
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
    padding: 20,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#1e3a8a',
  },
  scrollView: {
    marginVertical: 10,
  },
  policyText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  acceptButton: {
    backgroundColor: '#2563eb',
  },
  cancelButtonText: {
    color: '#4b5563',
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
