import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ManagerDashboard() {
  return (
    <View style={styles.container}>
      
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/SignIn')}>
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>Super Admin Dashboard</Text>

      {/* USER ACCESS MANAGEMENT BUTTON */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => router.push('/UserAccess')}
      >
        <Ionicons name="people" size={24} color="#00113D" style={{ marginRight: 8 }} />
        <Text style={styles.menuText}>Manage User Access</Text>
      </TouchableOpacity>

      {/* CIRCUIT MANAGEMENT BUTTON */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => router.push('/CircuitManage')}   // <-- Navigate to circuit manage screen
      >
        <Ionicons name="home" size={24} color="#00113D" style={{ marginRight: 8 }} />
        <Text style={styles.menuText}>Manage Circuit Bungalows</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00113D',
    alignItems: 'center',
    paddingTop: 120,
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
    fontWeight: '700',
    marginBottom: 40,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB600',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '80%',
    justifyContent: 'center',
    marginTop: 10,
  },
  menuText: {
    color: '#00113D',
    fontSize: 16,
    fontWeight: '700',
  },
});
