import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function UserDashboard() {
  return (
    <View style={styles.container}>

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace('/SignIn')}
      >
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>User Dashboard</Text>

      {/* View Bungalows Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/UserBungalows')}
      >
        <Text style={styles.buttonText}>View Available Bungalows</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00113D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 5,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 40,
  },

  button: {
    backgroundColor: '#FFB600',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
    width: '80%',
    alignItems: 'center',
  },

  buttonText: {
    color: '#00113D',
    fontSize: 16,
    fontWeight: '700',
  },
});
