// NSB_Booking/app/CircuitDetails.tsx
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
import { API_URL } from './config';

const NAVY = '#020038';
const YELLOW = '#FFB600';
const BLACK_BOX = '#050515';

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
        headers, // ✅ x-user-id so removed_by is updated
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
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={YELLOW} size="large" />
        <Text style={styles.loaderText}>Loading...</Text>
      </View>
    );
  }

  if (!circuit) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.loaderText}>No circuit found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      {/* Back icon */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Circuit Card */}
      <View style={styles.card}>
        <Text style={styles.title}>{circuit.circuit_Name}</Text>

        <Text style={styles.infoLine}>
          <Text style={styles.infoLabel}>City: </Text>
          <Text style={styles.infoValue}>{circuit.city}</Text>
        </Text>

        <Text style={styles.infoLine}>
          <Text style={styles.infoLabel}>Street: </Text>
          <Text style={styles.infoValue}>{circuit.street}</Text>
        </Text>

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
            <Text style={styles.roomTitle}>{r.room_Name}</Text>
            <Text style={styles.roomLine}>
              Rooms: {r.room_Count} | Max per room: {r.max_Persons}
            </Text>
            <Text style={styles.roomLine}>Price per person: Rs. {r.price_per_person}</Text>
            {!!r.description && <Text style={styles.roomDesc}>{r.description}</Text>}
          </View>
        ))
      )}

      {/* ✅ More Images in BLACK BOX CARD */}
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

      {/* ✅ Buttons inside ScrollView (after images) */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: YELLOW }]}
          onPress={() =>
            router.push({
              pathname: '/EditCircuit',
              params: { circuitId: String(circuit.circuit_Id) },
            })
          }
        >
          <Text style={[styles.actionText, { color: NAVY }]}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#D9534F' }]}
          onPress={deleting ? undefined : handleDelete}
        >
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {deleting && (
        <View style={styles.deleteStatus}>
          <ActivityIndicator size="small" color={YELLOW} />
          <Text style={styles.deleteStatusText}>Deactivating...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: NAVY,
    paddingTop: 50,
    paddingHorizontal: '6%',
    paddingBottom: 40,
  },

  backButton: {
    alignSelf: 'flex-start',
    padding: 6,
    marginBottom: 10,
  },

  card: {
    width: '100%',
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },

  infoLine: { marginBottom: 4 },
  infoLabel: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  infoValue: { color: '#D6D0C6', fontSize: 13 },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },

  smallText: { color: '#B8B0A5', fontSize: 12 },

  mainImage: { width: '100%', height: 180, borderRadius: 12 },

  roomCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },

  roomTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  roomLine: { color: '#D6D0C6', fontSize: 12, marginBottom: 4 },
  roomDesc: { color: '#B8B0A5', fontSize: 12, marginTop: 4 },

  extraImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginTop: 10,
  },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },

  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  actionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  deleteStatus: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteStatusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FFD2CF',
    fontWeight: '500',
  },

  loaderWrap: {
    flex: 1,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  loaderText: {
    color: '#FFFFFF',
    marginTop: 10,
  },
});
