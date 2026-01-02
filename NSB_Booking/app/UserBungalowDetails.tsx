// app/UserBungalowDetails.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  TouchableOpacity,
  Image, // ✅ use RN Image
} from 'react-native';

import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type CircuitDetailsResponse = {
  message?: string;
  circuit?: any;
  rooms?: any[];
  images?: any[];
};

const NAVY = '#020038';
const CREAM = '#FFEBD3';
const BLACK_BOX = '#050515';

const API_URL =
  Platform.OS === 'web'
    ? 'http://localhost:3001'
    : 'http://192.168.8.111:3001';

const UserBungalowDetailsScreen = () => {
  // Read all params and be flexible with the key name
  const params = useLocalSearchParams();
  const circuitId =
    (params.circuitId as string) ||
    (params.id as string) ||
    (params.circuit_Id as string);

  const [data, setData] = useState<CircuitDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadDetails = async () => {
      console.log(
        'DEBUG UserBungalowDetails circuitId >>>',
        circuitId,
        'params=',
        params
      );

      if (!circuitId) {
        setErrorMessage('No circuit id provided to details screen.');
        setLoading(false);
        return;
      }

      try {
        const url = `${API_URL}/circuits/${circuitId}`;
        console.log('DEBUG fetching user bungalow details from:', url);

        const res = await fetch(url);
        const json: CircuitDetailsResponse = await res.json().catch((e) => {
          console.log('JSON parse error:', e);
          return {} as CircuitDetailsResponse;
        });

        console.log('DEBUG /circuits/:id response >>>', json);

        if (!res.ok) {
          const msg = json.message || `Server returned status ${res.status}`;
          setErrorMessage(msg);
          setLoading(false);
          return;
        }

        if (!json || !json.circuit) {
          setErrorMessage('API did not return circuit data.');
          setLoading(false);
          return;
        }

        setData(json);
        setErrorMessage(null);
      } catch (err) {
        console.log('Request error (load user bungalow details):', err);
        setErrorMessage('Cannot connect to server.');
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [circuitId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading bungalow details...</Text>
      </View>
    );
  }

  if (!data || !data.circuit) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>
          {errorMessage || 'Details not available.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButtonCenter}
        >
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { circuit, rooms = [], images = [] } = data;

  // ✅ helper to turn DB path into full URL
  const buildImageUrl = (path?: string | null) => {
    if (!path) return null;

    // already full URL?
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const normalized = path.startsWith('/') ? path.slice(1) : path;
    return `${API_URL}/${normalized}`;
  };

  const mainImageUrl = buildImageUrl(circuit.imagePath);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Top back arrow */}
      <TouchableOpacity
        style={styles.headerBack}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.title}>{circuit.circuit_Name}</Text>

        <Text style={styles.line}>
          <Text style={styles.label}>City: </Text>
          {circuit.city}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>Street: </Text>
          {circuit.street}
        </Text>

        <Text style={styles.sectionTitle}>Main Image</Text>
        {mainImageUrl ? (
          <Image
            source={{ uri: mainImageUrl }}
            style={styles.mainImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.smallText}>No main image</Text>
        )}

        <Text style={styles.line}>
          <Text style={styles.label}>Created By: </Text>
          {circuit.createdByName || circuit.createdBy || 'Unknown'}
        </Text>

        <Text style={styles.line}>
          <Text style={styles.label}>Created Date: </Text>
          {circuit.createdDate
            ? new Date(circuit.createdDate).toLocaleString()
            : '-'}
        </Text>

        <Text style={styles.line}>
          <Text style={styles.label}>Updated Date: </Text>
          {circuit.updatedDate
            ? new Date(circuit.updatedDate).toLocaleString()
            : '-'}
        </Text>
      </View>

      {/* Rooms */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Rooms</Text>
      {rooms.length === 0 ? (
        <Text style={styles.smallText}>No rooms found.</Text>
      ) : (
        rooms.map((room: any) => (
          <View key={room.room_Id} style={styles.subCard}>
            <Text style={styles.cardTitle}>{room.room_Name}</Text>
            <Text style={styles.cardLine}>
              Count: {room.room_Count} • Max Persons: {room.max_Persons}
            </Text>
            <Text style={styles.cardLine}>
              Price per person: {room.price_per_person}
            </Text>
            {room.description && (
              <Text style={styles.cardLineSmall}>{room.description}</Text>
            )}
          </View>
        ))
      )}

      {/* Extra Images */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Extra Images</Text>
      {images.length === 0 ? (
        <Text style={styles.smallText}>No extra images.</Text>
      ) : (
        images.map((img: any) => {
          const uri = buildImageUrl(img.imagePath);
          return (
            <View key={img.image_Id} style={styles.subCard}>
              {uri ? (
                <Image
                  source={{ uri }}
                  style={styles.extraImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.cardLineSmall}>
                  Invalid image path: {img.imagePath}
                </Text>
              )}

              <Text style={styles.cardLineSmall}>
                Added:{' '}
                {img.createdDate
                  ? new Date(img.createdDate).toLocaleString()
                  : '-'}
              </Text>
            </View>
          );
        })
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backButtonBottom}
      >
        <Text style={styles.backText}>Back to bungalows list</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default UserBungalowDetailsScreen;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: '6%',
    paddingTop: 60,
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
  loadingText: {
    color: '#FFFFFF',
    marginTop: 8,
  },
  headerBack: {
    position: 'absolute',
    top: 20,
    left: 16,
    zIndex: 10,
    padding: 4,
  },
  card: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  line: {
    color: '#E2DCD2',
    fontSize: 14,
    marginBottom: 4,
  },
  label: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  smallText: {
    color: '#DDD3C8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  subCard: {
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
    color: '#E0D9CE',
    fontSize: 13,
  },
  cardLineSmall: {
    color: '#B8B0A5',
    fontSize: 12,
    marginTop: 3,
  },
  backButtonCenter: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CREAM,
  },
  backButtonBottom: {
    marginTop: 24,
    alignItems: 'center',
  },
  backText: {
    color: CREAM,
    fontWeight: '600',
    fontSize: 14,
  },
  mainImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  extraImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 8,
  },
});
