// UserBungalows.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';

const NAVY = '#020038';
const BLACK_BOX = '#050515';
const CREAM = '#FFEBD3';
const GOLD = '#FFB600';


export default function UserBungalows() {
  const params = useLocalSearchParams();
  const userId = String(params.userId ?? ''); // ✅ receive from dashboard

  const [circuits, setCircuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // hover/press state for icon background
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isIconActive = (key: string, pressed: boolean) => pressed || hoveredId === key;

  const fetchCircuits = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/circuits`);
      const data = await res.json();
      setCircuits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log('Error loading circuits for user:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCircuits();
  }, []);

  const openDetails = (circuit: any) => {
    if (!userId) {
      Alert.alert('User not found', 'UserId is missing. Please login again.');
      return;
    }

    router.push({
      pathname: '/UserBungalowDetails',
      params: {
        circuitId: String(circuit.circuit_Id),
        userId: userId, // ✅ IMPORTANT: forward userId
      },
    });
  };

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Back Arrow */}
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Welcome / Header Card (theme only) */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Available Bungalows</Text>
          <Text style={styles.welcomeSub}>Choose a bungalow to continue</Text>
        </View>

        {loading && <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />}

        {!loading && circuits.length === 0 && (
          <Text style={styles.emptyText}>No bungalows available.</Text>
        )}

        {circuits.map((circuit) => {
          const id = String(circuit.circuit_Id);

          return (
            <Pressable
              key={id}
              style={styles.card}
              onPress={() => openDetails(circuit)}
              onHoverIn={() => setHoveredId(id)}
              onHoverOut={() => setHoveredId((p) => (p === id ? null : p))}
            >
              {({ pressed }) => {
                const active = isIconActive(id, pressed);
                return (
                  <>
                    {/* Icon: NO background by default, GOLD background only on hover/press */}
                    <View style={active ? styles.cardIconActive : styles.cardIconIdle}>
                      <Ionicons name="home-outline" size={20} color={active ? NAVY : GOLD} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{circuit.circuit_Name}</Text>
                      <Text style={styles.cardLine}>
                        {circuit.city} • {circuit.street}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={GOLD} />
                  </>
                );
              }}
            </Pressable>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: '6%',
    paddingTop: 80,
    paddingBottom: 40,
  },

  headerBack: {
    position: 'absolute',
    top: 30,
    left: 16,
    zIndex: 10,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  welcomeCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },

  welcomeSub: {
    color: '#CFC7BD',
    fontSize: 13,
    textAlign: 'center',
  },

  emptyText: {
    color: CREAM,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },

  card: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // default (no filled background) - matches your screenshot style
  cardIconIdle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,200,87,0.65)',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // on hover / press (filled gold background)
  cardIconActive: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: GOLD,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },

  cardLine: {
    color: '#BFB8AE',
    fontSize: 12,
  },
});
