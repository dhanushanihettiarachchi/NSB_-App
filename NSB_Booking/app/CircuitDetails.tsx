// app/CircuitDetails.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

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

const API_URL =
  Platform.OS === 'web'
    ? 'http://localhost:3001'
    : 'http://192.168.8.111:3001';

const CircuitDetailsScreen = () => {
  const { circuitId } = useLocalSearchParams<{ circuitId?: string }>();

  const [data, setData] = useState<CircuitDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadDetails = async () => {
      console.log('DEBUG CircuitDetails circuitId >>>', circuitId);

      if (!circuitId) {
        setErrorMessage('No circuit id provided to details screen.');
        setLoading(false);
        return;
      }

      try {
        const url = `${API_URL}/circuits/${circuitId}`;
        console.log('DEBUG fetching details from:', url);

        const res = await fetch(url);
        const json: CircuitDetailsResponse = await res.json().catch((e) => {
          console.log('DEBUG JSON parse error:', e);
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
        console.log('Request error (load details):', err);
        setErrorMessage('Cannot connect to server.');
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [circuitId]);

  // Actual delete logic (called after user confirms)
  const performDelete = async () => {
    if (!circuitId) {
      Alert.alert('Error', 'No circuit id found.');
      return;
    }

    try {
      setDeleting(true);

      const res = await fetch(`${API_URL}/circuits/${circuitId}/deactivate`, {
        method: 'PATCH',
      });

      let json: any = {};
      try {
        json = await res.json();
      } catch (e) {
        console.log('JSON parse error (deactivate):', e);
      }

      console.log('DEBUG deactivate response >>>', json);

      if (!res.ok) {
        console.log('Error deactivating:', json);
        Alert.alert('Error', json.message || 'Could not deactivate circuit');
        setDeleting(false);
        return;
      }

      // Success
      setDeleting(false);

      if (Platform.OS === 'web') {
        Alert.alert('Deleted', 'Circuit was deactivated successfully.');
        router.replace('/CircuitManage');
      } else {
        Alert.alert('Deleted', 'Circuit was deactivated successfully.', [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/CircuitManage');
            },
          },
        ]);
      }
    } catch (err) {
      console.log('Request error (deactivate):', err);
      setDeleting(false);
      Alert.alert('Error', 'Cannot connect to server.');
    }
  };

  // DELETE with confirmation
  const handleDelete = () => {
    if (!circuitId) {
      Alert.alert('Error', 'No circuit id found.');
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to deactivate this circuit?'
      );
      if (!confirmed) return;
      performDelete();
    } else {
      Alert.alert(
        'Confirm Delete',
        'Are you sure you want to deactivate this circuit?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Deactivate',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
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
    // Show more useful error message
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>
          {errorMessage || 'Details not available.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
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

        <Text style={styles.line}>
          <Text style={styles.label}>City: </Text>
          {circuit.city}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.label}>Street: </Text>
          {circuit.street}
        </Text>

        <Text style={styles.line}>
          <Text style={styles.label}>Main Image: </Text>
          {circuit.imagePath || '-'}
        </Text>

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

        <Text style={styles.line}>
          <Text style={styles.label}>Active: </Text>
          {circuit.is_active ? 'Yes' : 'No'}
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

      {/* Images */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Extra Images</Text>
      {images.length === 0 ? (
        <Text style={styles.smallText}>No extra images.</Text>
      ) : (
        images.map((img: any) => (
          <View key={img.image_Id} style={styles.subCard}>
            <Text style={styles.cardLine}>{img.imagePath}</Text>
            <Text style={styles.cardLineSmall}>
              Added:{' '}
              {img.createdDate
                ? new Date(img.createdDate).toLocaleString()
                : '-'}
            </Text>
          </View>
        ))
      )}

      {/* Buttons */}
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

      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backButton}
      >
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
  loadingText: {
    color: '#FFFFFF',
    marginTop: 8,
  },
  card: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 18,
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
  buttonRow: {
    flexDirection: 'row',
    marginTop: 24,
    justifyContent: 'space-between',
    gap: 12,
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
    marginTop: 12,
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
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backText: {
    color: CREAM,
    fontWeight: '600',
    fontSize: 14,
  },
});
