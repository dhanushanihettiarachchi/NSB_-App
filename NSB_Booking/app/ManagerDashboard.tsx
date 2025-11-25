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


      <Text style={styles.text}>Manager Dashboard Screen</Text>
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
  text: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 5,
  },
});
