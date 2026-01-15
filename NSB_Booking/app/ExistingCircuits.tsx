import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from './config';

const NAVY = '#020038';
const BLACK_BOX = '#050515';

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
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Existing Circuits</Text>

      {listLoading && <ActivityIndicator color="#fff" style={{ marginTop: 10 }} />}

      {circuits.map((c) => (
        <TouchableOpacity
          key={c.circuit_Id}
          style={styles.cardSmall}
          onPress={() =>
            router.push({
              pathname: '/CircuitDetails',
              params: { circuitId: String(c.circuit_Id), t: String(Date.now()) },
            })
          }
        >
          <Text style={styles.cardTitle}>{c.circuit_Name}</Text>
          <Text style={styles.cardLine}>
            {c.city} • {c.street}
          </Text>

          {c.imagePath ? (
            <Image
              key={c.imagePath}
              source={{ uri: toFullUrl(c.imagePath) }}
              style={{ width: '100%', height: 120, borderRadius: 12, marginTop: 8 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.cardLineSmall}>No main image</Text>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: NAVY, paddingHorizontal: '6%', paddingTop: 40, paddingBottom: 30 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  topRow: { position: 'absolute', top: 40, left: 20, zIndex: 10 },
  backButton: { padding: 4 },
  cardSmall: { backgroundColor: BLACK_BOX, borderRadius: 14, padding: 12, marginTop: 8 },
  cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cardLine: { color: '#E0DBD3', fontSize: 13 },
  cardLineSmall: { color: '#B8B0A5', fontSize: 12, marginTop: 2 },
});
