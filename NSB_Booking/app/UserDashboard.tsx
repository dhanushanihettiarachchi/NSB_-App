import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';


export default function UserDashboard() {
  return (
    <View style={styles.container}>
      {/* Back to Sign In */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace('/SignIn')}
      >
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>User Dashboard</Text>

      {/* View bungalows button */}
      <TouchableOpacity
        style={styles.mainButton}
        onPress={() => router.push('/UserBungalows')}
      >
        <Text style={styles.mainButtonText}>
          View Available Bungalows
        </Text>
      </TouchableOpacity>

      {/* ✅ Add Booking button */}
      <TouchableOpacity
        style={[styles.mainButton, styles.secondaryButton]}
        onPress={() => router.push('/Bookings')}
      >
        <Text style={styles.mainButtonText}>
          Add Booking
        </Text>
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
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 5,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 28,
  },
  mainButton: {
    backgroundColor: '#FFB600',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 10,
    width: '75%',
    alignItems: 'center',
    marginBottom: 14,
  },
  secondaryButton: {
    backgroundColor: '#FFB600',
  },
  mainButtonText: {
    color: '#00113D',
    fontSize: 16,
    fontWeight: '700',
  },
});
