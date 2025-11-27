import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

const NAVY = '#020038';
const GOLD = '#FFB600';

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/SignIn');
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.screen}>
      <Image
        source={require('../assets/images/nsb/nsb-logo-new.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>NSB Holiday Home Reservations</Text>
      <Text style={styles.subtitle}>National Savings Bank</Text>

      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 25,
  },
  title: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#BBBBBB',
    textAlign: 'center',
    marginBottom: 40,
  },
  loaderContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 10,
    opacity: 0.8,
  },
});
