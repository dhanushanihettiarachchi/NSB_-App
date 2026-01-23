// NSB_Booking/app/ExistingCircuits.tsx
// NSB Booking App - Existing Circuits Screen
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';

const NAVY = '#020038';
const YELLOW = '#FFB600';
const MUTED = 'rgba(255,255,255,0.70)';
const CARD_BG = 'rgba(10,10,26,0.88)';

const toFullUrl = (p?: string) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return `${API_URL}${p}`;
};

export default function ExistingCircuits() {
  const [circuits, setCircuits] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const fetchCircuits = useCallback(async () => {
    try {
      setListLoading(true);
      const res = await fetch(`${API_URL}/circuits?t=${Date.now()}`, {
        headers: Platform.OS === 'web' ? { 'Cache-Control': 'no-store' } : undefined,
      });
      const data = await res.json();
      setCircuits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log('Error loading circuits:', err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCircuits();
  }, [fetchCircuits]);

  useFocusEffect(
    useCallback(() => {
      fetchCircuits();
    }, [fetchCircuits])
  );

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      {/* Back button (same as other screens) */}
      <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Existing Circuits</Text>
        <Text style={styles.subtitle}>Tap a circuit to view details</Text>
      </View>

      {/* Scroll (fix white overscroll) */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {listLoading ? <ActivityIndicator color={YELLOW} style={{ marginTop: 10 }} /> : null}

        {circuits.map((c) => (
          <Pressable
            key={c.circuit_Id}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.95, transform: [{ scale: 0.995 }] }]}
            onPress={() =>
              router.push({
                pathname: '/CircuitDetails',
                params: { circuitId: String(c.circuit_Id), t: String(Date.now()) },
              })
            }
          >
            <View style={styles.cardTop}>
              <View style={styles.iconPill}>
                <Ionicons name="home-outline" size={18} color={YELLOW} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{c.circuit_Name}</Text>
                <Text style={styles.cardLine}>
                  {c.city} • {c.street}
                </Text>
              </View>

              <View style={styles.chevPill}>
                <Ionicons name="chevron-forward" size={18} color={YELLOW} />
              </View>
            </View>

            {c.imagePath ? (
              <Image
                key={c.imagePath}
                source={{ uri: toFullUrl(c.imagePath) }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.cardLineSmall}>No main image</Text>
            )}
          </Pressable>
        ))}

        <View style={{ height: 26 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },

  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: {
    flexGrow: 1,
    paddingHorizontal: '7%',
    paddingTop: 120,
    paddingBottom: 30,
  },

  headerBack: {
    position: 'absolute',
    top: 30,
    left: 16,
    zIndex: 20,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  header: {
    position: 'absolute',
    top: 78,
    left: 0,
    right: 0,
    zIndex: 15,
    alignItems: 'center',
    paddingHorizontal: '7%',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    marginTop: 12,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  iconPill: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,182,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  cardLine: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', marginTop: 4 },
  cardLineSmall: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700', marginTop: 10 },

  chevPill: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: 'rgba(255,182,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  image: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
});
