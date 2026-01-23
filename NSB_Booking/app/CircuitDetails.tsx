// NSB_Booking/app/CircuitDetails.tsx
// NSB Booking App - Circuit Details Screen
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';

const NAVY = '#020038';
const YELLOW = '#FFB600';
const MUTED = 'rgba(255,255,255,0.70)';
const MUTED2 = 'rgba(255,255,255,0.45)';
const CARD_BG = 'rgba(10,10,26,0.88)';

const toFullUrl = (p?: string) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return `${API_URL}${p}`;
};

type Circuit = {
  circuit_Id: number;
  circuit_Name: string;
  city: string;
  street: string;
  imagePath?: string;
};

type Room = {
  room_Id: number;
  room_Name: string;
  room_Count: number;
  max_Persons: number;
  price_per_person: number;
  description?: string;
};

type ExtraImage = {
  image_Id: number;
  imagePath: string;
};

async function getLoggedInUserId(): Promise<number | null> {
  const keys = ['user_id', 'userId', 'id'];
  for (const k of keys) {
    const v = await AsyncStorage.getItem(k);
    const n = v ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function buildHeaders() {
  const userId = await getLoggedInUserId();
  const headers: Record<string, string> = {};
  if (userId) headers['x-user-id'] = String(userId);
  if (Platform.OS === 'web') headers['Cache-Control'] = 'no-store';
  return headers;
}

export default function CircuitDetails() {
  const { circuitId } = useLocalSearchParams<{ circuitId: string }>();
  const id = useMemo(() => Number(circuitId), [circuitId]);

  const [loading, setLoading] = useState(true);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [images, setImages] = useState<ExtraImage[]>([]);
  const [deleting, setDeleting] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!id || Number.isNaN(id)) {
      Alert.alert('Error', 'Invalid circuit id');
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/circuits/${id}?t=${Date.now()}`, {
        headers: await buildHeaders(),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Error', json.message || 'Failed to load circuit details');
        return;
      }

      setCircuit(json.circuit || null);
      setRooms(Array.isArray(json.rooms) ? json.rooms : []);
      setImages(Array.isArray(json.images) ? json.images : []);
    } catch (e) {
      console.log('Details load error:', e);
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const performDelete = async () => {
    if (!id || Number.isNaN(id)) return Alert.alert('Error', 'Invalid circuit id');

    try {
      setDeleting(true);

      const headers = await buildHeaders();

      const res = await fetch(`${API_URL}/circuits/${id}/deactivate`, {
        method: 'PATCH',
        headers,
      });

      let json: any = {};
      try {
        json = await res.json();
      } catch {}

      if (!res.ok) {
        Alert.alert('Error', json.message || 'Could not deactivate circuit');
        return;
      }

      Alert.alert('Deleted', 'Circuit was deactivated successfully.');
      router.replace('/CircuitManage');
    } catch (err) {
      console.log('Request error (deactivate):', err);
      Alert.alert('Error', 'Cannot connect to server.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    if (!id || Number.isNaN(id)) return Alert.alert('Error', 'Invalid circuit id');

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to deactivate this circuit?');
      if (!confirmed) return;
      performDelete();
    } else {
      Alert.alert('Confirm Delete', 'Are you sure you want to deactivate this circuit?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Deactivate', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
        <View style={styles.center}>
          <ActivityIndicator color={YELLOW} size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!circuit) {
    return (
      <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>No circuit found.</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      {/* Back button */}
      <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Circuit Details</Text>
        <Text style={styles.subtitle}>View rooms & images</Text>
      </View>

      {/* Scroll */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Circuit Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{circuit.circuit_Name}</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="location-outline" size={18} color={YELLOW} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>City</Text>
              <Text style={styles.infoValue}>{circuit.city}</Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginTop: 10 }]}>
            <View style={styles.infoIcon}>
              <Ionicons name="navigate-outline" size={18} color={YELLOW} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Street</Text>
              <Text style={styles.infoValue}>{circuit.street}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Main Image</Text>

          {circuit.imagePath ? (
            <Image source={{ uri: toFullUrl(circuit.imagePath) }} style={styles.mainImage} resizeMode="cover" />
          ) : (
            <Text style={styles.smallText}>No main image</Text>
          )}
        </View>

        {/* Rooms */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Rooms</Text>

        {rooms.length === 0 ? (
          <Text style={styles.smallText}>No rooms available.</Text>
        ) : (
          rooms.map((r) => (
            <View key={r.room_Id} style={styles.roomCard}>
              <View style={styles.roomTop}>
                <Text style={styles.roomTitle}>{r.room_Name}</Text>
                <View style={styles.pricePill}>
                  <Ionicons name="pricetag-outline" size={13} color={YELLOW} />
                  <Text style={styles.pricePillText}>Rs {r.price_per_person}</Text>
                </View>
              </View>

              <Text style={styles.roomLine}>
                Rooms: {r.room_Count}  •  Max per room: {r.max_Persons}
              </Text>

              {!!r.description && <Text style={styles.roomDesc}>{r.description}</Text>}
            </View>
          ))
        )}

        {/* More Images */}
        <View style={[styles.card, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>More Images</Text>

          {images.length === 0 ? (
            <Text style={styles.smallText}>No extra images.</Text>
          ) : (
            images.slice(0, 8).map((img) => (
              <Image
                key={img.image_Id}
                source={{ uri: toFullUrl(img.imagePath) }}
                style={styles.extraImage}
                resizeMode="cover"
              />
            ))
          )}
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btnPrimary, { flex: 1 }]}
            onPress={() =>
              router.push({
                pathname: '/EditCircuit',
                params: { circuitId: String(circuit.circuit_Id) },
              })
            }
            activeOpacity={0.9}
          >
            <Text style={styles.btnPrimaryText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnDanger, { flex: 1 }]}
            onPress={deleting ? undefined : handleDelete}
            activeOpacity={0.9}
          >
            <Text style={styles.btnDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {deleting && (
          <View style={styles.deleteStatus}>
            <ActivityIndicator size="small" color={YELLOW} />
            <Text style={styles.deleteStatusText}>Deactivating...</Text>
          </View>
        )}

        <View style={{ height: 26 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },

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

  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' },

  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: {
    flexGrow: 1,
    paddingHorizontal: '7%',
    paddingTop: 130,
    paddingBottom: 30,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFFFFF', marginTop: 10, fontWeight: '700' },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },

  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 14,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },

  smallText: { color: MUTED2, fontSize: 12, fontWeight: '700' },

  infoRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: 'rgba(255,182,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoLabel: { color: MUTED, fontSize: 12, fontWeight: '800' },
  infoValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginTop: 2 },

  mainImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  roomCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
  },

  roomTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  roomTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', flex: 1 },

  roomLine: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },

  roomDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    lineHeight: 16,
  },

  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,182,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.25)',
  },

  pricePillText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },

  extraImage: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },

  btnPrimary: {
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: NAVY, fontWeight: '900', fontSize: 14 },

  btnDanger: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,120,120,0.30)',
    backgroundColor: 'rgba(255,90,90,0.18)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDangerText: { color: '#FFB3B3', fontWeight: '900', fontSize: 14 },

  deleteStatus: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteStatusText: { fontSize: 13, color: '#FFD2CF', fontWeight: '800' },
});
