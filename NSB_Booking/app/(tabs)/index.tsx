import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>NSB Booking</Text>
      <Text style={styles.appSubtitle}>Circuit Bungalow Reservation System</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome 👋</Text>
        <Text style={styles.cardText}>
          This is your NSB staff booking app. Soon you will be able to:
        </Text>
        <Text style={styles.bullet}>• Check if you are a valid NSB employee using EPF</Text>
        <Text style={styles.bullet}>• Create your account by setting a password</Text>
        <Text style={styles.bullet}>• Log in and request circuit bungalow reservations</Text>
      </View>

      <Text style={styles.footerNote}>
        Next step: we will add the first screen for registration (EPF + full name check).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060340', // NSB blue style
    paddingHorizontal: 20,
    paddingTop: 80,
  },
  appTitle: {
    color: '#FDB913', // NSB gold
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  appSubtitle: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    color: '#060340',
  },
  cardText: {
    fontSize: 14,
    color: '#333333',
  },
  bullet: {
    fontSize: 14,
    color: '#333333',
    marginTop: 4,
  },
  footerNote: {
    marginTop: 24,
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.8,
  },
});
