import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

type CircuitDetailsResponse = {
  message?: string;
  circuit?: any;
  rooms?: any[];
  images?: any[];
};

const NAVY = '#020038';
const YELLOW = '#FFB600';
const CREAM = '#FFEBD3';
const BLACK_BOX = '#050515';


const toFullUrl = (p?: string) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return `${API_URL}${p}`;
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

const CircuitDetailsScreen = () => {
  const { circuitId, t } = useLocalSearchParams<{ circuitId?: string; t?: string }>();

  const [data, setData] = useState<CircuitDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    if (!circuitId) {
      setErrorMessage('No circuit id provided to details screen.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // ✅ cache buster param
      const url = `${API_URL}/circuits/${circuitId}?t=${Date.now()}`;
      const res = await fetch(url, { headers: await buildHeaders() });

      const json: CircuitDetailsResponse = await res.json().catch(() => ({} as CircuitDetailsResponse));

      if (!res.ok) {
        setErrorMessage(json.message || `Server returned status ${res.status}`);
        setData(null);
        return;
      }

      if (!json?.circuit) {
        setErrorMessage('API did not return circuit data.');
        setData(null);
        return;
      }

      setData(json);
      setErrorMessage(null);
    } catch (err) {
      console.log('Request error (load details):', err);
      setErrorMessage('Cannot connect to server.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [circuitId]);

  // ✅ always reload when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadDetails();
    }, [loadDetails])
  );

  // ✅ reload when param changes (Edit screen can push ?t=...)
  useEffect(() => {
    if (t) loadDetails();
  }, [t, loadDetails]);

  const performDelete = async () => {
    if (!circuitId) return Alert.alert('Error', 'No circuit id found.');

    try {
      setDeleting(true);

      const headers = await buildHeaders();

      const res = await fetch(`${API_URL}/circuits/${circuitId}/deactivate`, {
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
      router.replace('/CircuitManage'); // ✅ list screen will refresh on focus
    } catch (err) {
      console.log('Request error (deactivate):', err);
      Alert.alert('Error', 'Cannot connect to server.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    if (!circuitId) return Alert.alert('Error', 'No circuit id found.');

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading circuit details...</Text>
      </View>
    );
  }

  if (!data || !data.circuit) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>{errorMessage || 'Details not available.'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { circuit, rooms = [], images = [] } = data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{circuit.circuit_Name}</Text>

        <Text style={styles.line}><Text style={styles.label}>City: </Text>{circuit.city}</Text>
        <Text style={styles.line}><Text style={styles.label}>Street: </Text>{circuit.street}</Text>

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Main Image</Text>
        {circuit.imagePath ? (
          <Image
            source={{ uri: toFullUrl(circuit.imagePath) }}
            style={{ width: '100%', height: 180, borderRadius: 12, marginTop: 8 }}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.smallText}>No main image.</Text>
        )}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Rooms</Text>
      {rooms.length === 0 ? (
        <Text style={styles.smallText}>No rooms found.</Text>
      ) : (
        rooms.map((room: any) => (
          <View key={room.room_Id} style={styles.subCard}>
            <Text style={styles.cardTitle}>{room.room_Name}</Text>
            <Text style={styles.cardLine}>Count: {room.room_Count} • Max Persons: {room.max_Persons}</Text>
            <Text style={styles.cardLine}>Price per person: {room.price_per_person}</Text>
            {!!room.description && <Text style={styles.cardLineSmall}>{room.description}</Text>}
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Extra Images</Text>
      {images.length === 0 ? (
        <Text style={styles.smallText}>No extra images.</Text>
      ) : (
        images.map((img: any) => (
          <View key={img.image_Id} style={styles.subCard}>
            <Image
              source={{ uri: toFullUrl(img.imagePath) }}
              style={{ width: '100%', height: 140, borderRadius: 12 }}
              resizeMode="cover"
            />
            <Text style={styles.cardLineSmall} numberOfLines={2}>{img.imagePath}</Text>
          </View>
        ))
      )}

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

      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Back to list</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default CircuitDetailsScreen;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: '6%',
    paddingTop: 40,
    paddingBottom: 30,
    backgroundColor: NAVY,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: '#FFFFFF', marginTop: 8 },
  card: { backgroundColor: BLACK_BOX, borderRadius: 18, padding: 18 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  line: { color: '#E2DCD2', fontSize: 14, marginBottom: 4 },
  label: { fontWeight: '600', color: '#FFFFFF' },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 4 },
  smallText: { color: '#DDD3C8', fontSize: 13, fontStyle: 'italic' },
  subCard: { backgroundColor: BLACK_BOX, borderRadius: 14, padding: 12, marginTop: 8 },
  cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cardLine: { color: '#E0D9CE', fontSize: 13 },
  cardLineSmall: { color: '#B8B0A5', fontSize: 12, marginTop: 6 },
  buttonRow: { flexDirection: 'row', marginTop: 24, justifyContent: 'space-between', gap: 12 },
  actionButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  deleteStatus: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deleteStatusText: { marginLeft: 8, fontSize: 14, color: '#FFD2CF', fontWeight: '500' },
  backButton: { marginTop: 24, alignItems: 'center' },
  backText: { color: CREAM, fontWeight: '600', fontSize: 14 },
});
