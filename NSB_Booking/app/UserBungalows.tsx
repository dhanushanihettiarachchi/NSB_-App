import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from './config';

const NAVY = '#020038';
const BLACK_BOX = '#050515';
const CREAM = '#FFEBD3';



export default function UserBungalows() {
  const [circuits, setCircuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCircuits = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/circuits`);
      const data = await res.json();
      setCircuits(data);
    } catch (err) {
      console.log('Error loading circuits for user:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCircuits();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* back arrow to UserDashboard */}
      <TouchableOpacity
        style={styles.headerBack}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>Available Bungalows</Text>

      {loading && <ActivityIndicator color="#fff" />}

      {!loading && circuits.length === 0 && (
        <Text style={styles.emptyText}>No bungalows available.</Text>
      )}

      {circuits.map((circuit) => (
        <TouchableOpacity
          key={circuit.circuit_Id}
          style={styles.card}
          onPress={() =>
            router.push({
              pathname: '/UserBungalowDetails',
              params: { circuitId: String(circuit.circuit_Id) }, // 👈 IMPORTANT
            })
          }
        >
          <Text style={styles.cardTitle}>{circuit.circuit_Name}</Text>
          <Text style={styles.cardLine}>
            {circuit.city} • {circuit.street}
          </Text>
          
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: NAVY,
    paddingHorizontal: '6%',
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerBack: {
    position: 'absolute',
    top: 20,
    left: 16,
    zIndex: 10,
    padding: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: CREAM,
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  card: {
    backgroundColor: BLACK_BOX,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardLine: {
    color: '#E0DBD3',
    fontSize: 13,
  },
  cardLineSmall: {
    color: '#B8B0A5',
    fontSize: 12,
    marginTop: 2,
  },
});
