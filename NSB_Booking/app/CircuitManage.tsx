import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

type RoomPayload = {
  room_Name: string;
  room_Count: number;
  max_Persons: number;
  price_per_person: number;
  description?: string;
};

const NAVY = '#020038';
const YELLOW = '#FFB600';
const CREAM = '#FFEBD3';
const BLACK_BOX = '#050515';

const API_URL =
  Platform.OS === 'web'
    ? 'http://localhost:3001'
    : 'http://192.168.8.111:3001';

const toFullUrl = (p?: string) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return `${API_URL}${p}`;
};

// ✅ WEB: convert asset.uri → File
async function uriToFileWeb(uri: string, filename: string) {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

export default function ManageCircuitsScreen() {
  const [circuitName, setCircuitName] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');

  const [imagePath, setImagePath] = useState('');
  const [extraImages, setExtraImages] = useState('');

  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);

  const [roomName, setRoomName] = useState('');
  const [roomCount, setRoomCount] = useState('');
  const [maxPersons, setMaxPersons] = useState('');
  const [pricePerPerson, setPricePerPerson] = useState('');
  const [description, setDescription] = useState('');

  const [rooms, setRooms] = useState<RoomPayload[]>([]);
  const [loading, setLoading] = useState(false);

  const [circuits, setCircuits] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const fetchCircuits = useCallback(async () => {
    try {
      setListLoading(true);

      // ✅ cache-bust + no-store (web)
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

  // initial load
  useEffect(() => {
    fetchCircuits();
  }, [fetchCircuits]);

  // ✅ IMPORTANT: refresh list when coming back from details/edit
  useFocusEffect(
    useCallback(() => {
      fetchCircuits();
    }, [fetchCircuits])
  );

  const handleAddRoomType = () => {
    if (!roomName || !maxPersons || !pricePerPerson) {
      Alert.alert('Error', 'Please fill room name, max persons and price per person.');
      return;
    }

    const newRoom: RoomPayload = {
      room_Name: roomName,
      room_Count: Number(roomCount) || 1,
      max_Persons: Number(maxPersons) || 1,
      price_per_person: Number(pricePerPerson) || 0,
      description,
    };

    setRooms((prev) => [...prev, newRoom]);

    setRoomName('');
    setRoomCount('');
    setMaxPersons('');
    setPricePerPerson('');
    setDescription('');
  };

  // ---------------- MAIN upload ----------------
  const pickAndUploadMainImage = async () => {
    try {
      setUploadingMain(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];

      const form = new FormData();

      if (Platform.OS === 'web') {
        const file = await uriToFileWeb(asset.uri, `main_${Date.now()}.jpg`);
        form.append('image', file);
      } else {
        form.append('image', {
          uri: asset.uri,
          name: `main_${Date.now()}.jpg`,
          type: 'image/jpeg',
        } as any);
      }

      const res = await fetch(`${API_URL}/circuits/upload/main`, {
        method: 'POST',
        body: form,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        Alert.alert('Upload failed', json.message || 'Could not upload image');
        return;
      }

      setImagePath(json.imagePath);
    } catch (err) {
      console.log('Main upload error:', err);
      Alert.alert('Error', 'Upload failed.');
    } finally {
      setUploadingMain(false);
    }
  };

  // ---------------- EXTRA upload ----------------
  const pickAndUploadExtraImages = async () => {
    try {
      setUploadingExtra(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (result.canceled || !result.assets?.length) return;

      const form = new FormData();

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];

        if (Platform.OS === 'web') {
          const file = await uriToFileWeb(asset.uri, `extra_${Date.now()}_${i}.jpg`);
          form.append('images', file);
        } else {
          form.append('images', {
            uri: asset.uri,
            name: `extra_${Date.now()}_${i}.jpg`,
            type: 'image/jpeg',
          } as any);
        }
      }

      const res = await fetch(`${API_URL}/circuits/upload/extra`, {
        method: 'POST',
        body: form,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        Alert.alert('Upload failed', json.message || 'Could not upload images');
        return;
      }

      const newPaths: string[] = Array.isArray(json.imagePaths) ? json.imagePaths : [];

      const existing = extraImages
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const merged = [...existing, ...newPaths];
      setExtraImages(merged.join(', '));
    } catch (err) {
      console.log('Extra upload error:', err);
      Alert.alert('Error', 'Extra upload failed.');
    } finally {
      setUploadingExtra(false);
    }
  };

  // ---------------- SAVE circuit to DB ----------------
  const handleSave = async () => {
    if (!circuitName || !city || !street) {
      Alert.alert('Error', 'Please fill circuit name, city and street.');
      return;
    }

    if (rooms.length === 0) {
      Alert.alert('Error', 'Please add at least one room type before saving.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/circuits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circuit_Name: circuitName,
          city,
          street,
          imagePath,
          createdBy: 1,
          rooms,
          imagesText: extraImages,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        Alert.alert('Error', data.message || 'Something went wrong');
        return;
      }

      Alert.alert('Success', 'Circuit saved successfully!');

      setCircuitName('');
      setCity('');
      setStreet('');
      setImagePath('');
      setExtraImages('');
      setRoomName('');
      setRoomCount('');
      setMaxPersons('');
      setPricePerPerson('');
      setDescription('');
      setRooms([]);

      fetchCircuits();
    } catch (err) {
      console.log('Save error:', err);
      Alert.alert('Error', 'Cannot connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const extraPreview = extraImages
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/AdminDashboard')}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Manage Circuit Bungalows</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add New Circuit</Text>

        <Text style={styles.label}>Circuit Name</Text>
        <TextInput style={styles.input} value={circuitName} onChangeText={setCircuitName} />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} />

        <Text style={styles.label}>Street</Text>
        <TextInput style={styles.input} value={street} onChangeText={setStreet} />

        <Text style={styles.label}>Main Image</Text>

        {imagePath ? (
          <View style={{ marginBottom: 10 }}>
            <Image
              key={imagePath}
              source={{ uri: toFullUrl(imagePath) }}
              style={{ width: '100%', height: 160, borderRadius: 12 }}
              resizeMode="cover"
              onError={(e) => console.log('Main image load error:', e.nativeEvent)}
            />
            <Text style={styles.cardLineSmall}>Saved: {imagePath}</Text>
          </View>
        ) : (
          <Text style={styles.cardLineSmall}>No main image uploaded yet.</Text>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={pickAndUploadMainImage} disabled={uploadingMain}>
          {uploadingMain ? <ActivityIndicator color={YELLOW} /> : <Text style={styles.secondaryButtonText}>Pick & Upload Main Image</Text>}
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Add Room Types</Text>

        <Text style={styles.label}>Room Name</Text>
        <TextInput style={styles.input} value={roomName} onChangeText={setRoomName} />

        <Text style={styles.label}>Room Count</Text>
        <TextInput style={styles.input} value={roomCount} onChangeText={setRoomCount} keyboardType="numeric" />

        <Text style={styles.label}>Max Persons</Text>
        <TextInput style={styles.input} value={maxPersons} onChangeText={setMaxPersons} keyboardType="numeric" />

        <Text style={styles.label}>Price Per Person</Text>
        <TextInput style={styles.input} value={pricePerPerson} onChangeText={setPricePerPerson} keyboardType="numeric" />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, { height: 80 }]} value={description} onChangeText={setDescription} multiline />

        <TouchableOpacity style={styles.secondaryButton} onPress={handleAddRoomType}>
          <Text style={styles.secondaryButtonText}>+ Add Room Type</Text>
        </TouchableOpacity>

        {rooms.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.subHeader}>Added Room Types</Text>
            {rooms.map((r, index) => (
              <View key={index} style={styles.roomChip}>
                <Text style={styles.roomChipTitle}>{r.room_Name}</Text>
                <Text style={styles.roomChipText}>
                  Count: {r.room_Count} | Max: {r.max_Persons} | Rs. {r.price_per_person}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Extra Images</Text>

        {extraPreview.length > 0 ? (
          <Text style={styles.cardLineSmall}>Saved: {extraPreview.length} images</Text>
        ) : (
          <Text style={styles.cardLineSmall}>No extra images uploaded yet.</Text>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={pickAndUploadExtraImages} disabled={uploadingExtra}>
          {uploadingExtra ? <ActivityIndicator color={YELLOW} /> : <Text style={styles.secondaryButtonText}>Pick & Upload Extra Images</Text>}
        </TouchableOpacity>

        {extraPreview.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {extraPreview.slice(0, 6).map((p, idx) => (
              <Image
                key={p + idx}
                source={{ uri: toFullUrl(p) }}
                style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 8 }}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          {loading ? <ActivityIndicator color={NAVY} /> : <Text style={styles.buttonText}>Save Circuit + Rooms + Images</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Existing Circuits</Text>

        {listLoading && <ActivityIndicator color="#fff" />}

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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: NAVY, paddingHorizontal: '6%', paddingTop: 40, paddingBottom: 30 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  topRow: { position: 'absolute', top: 40, left: 20, zIndex: 10 },
  backButton: { padding: 4 },
  card: { width: '100%', backgroundColor: BLACK_BOX, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 18 },
  label: { color: '#FFFFFF', fontSize: 13, marginBottom: 4, marginTop: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  subHeader: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: CREAM, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, fontSize: 14 },
  button: { backgroundColor: YELLOW, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: NAVY, fontWeight: '700', fontSize: 15 },
  secondaryButton: { backgroundColor: '#2B2735', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  secondaryButtonText: { color: YELLOW, fontWeight: '600', fontSize: 14 },
  roomChip: { borderRadius: 10, padding: 10, marginBottom: 6, backgroundColor: '#171422' },
  roomChipTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  roomChipText: { color: '#D6D0C6', fontSize: 12 },
  listSection: { marginTop: 20 },
  cardSmall: { backgroundColor: BLACK_BOX, borderRadius: 14, padding: 12, marginTop: 8 },
  cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cardLine: { color: '#E0DBD3', fontSize: 13 },
  cardLineSmall: { color: '#B8B0A5', fontSize: 12, marginTop: 2 },
});
