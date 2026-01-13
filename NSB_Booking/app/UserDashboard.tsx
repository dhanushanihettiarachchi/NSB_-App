// app/UserDashboard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

export default function UserDashboard() {
  const params = useLocalSearchParams();
  const userId = String(params.userId ?? '');

  const goToBungalows = () => {
    if (!userId) {
      Alert.alert('User not found', 'Please login again.');
      return;
    }

    router.push({
      pathname: '/UserBungalows',
      params: { userId }, // ✅ PASS userId forward
    });
  };

  // ✅ NEW: go to user booking history (pending/approved/rejected)
  const goToMyBookings = () => {
    if (!userId) {
      Alert.alert('User not found', 'Please login again.');
      return;
    }

    router.push({
      pathname: '/UserBookings',
      params: { userId }, // ✅ PASS userId forward
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/SignIn')}>
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>User Dashboard</Text>

      <TouchableOpacity style={styles.mainButton} onPress={goToBungalows}>
        <Text style={styles.mainButtonText}>View Available Bungalows</Text>
      </TouchableOpacity>

      {/* ✅ NEW BUTTON */}
      <TouchableOpacity style={styles.secondaryButton} onPress={goToMyBookings}>
        <Text style={styles.secondaryButtonText}>My Bookings</Text>
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
  mainButtonText: {
    color: '#00113D',
    fontSize: 16,
    fontWeight: '700',
  },

  // ✅ NEW button style (outline look)
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFB600',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 10,
    width: '75%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFB600',
    fontSize: 16,
    fontWeight: '700',
  },
});
