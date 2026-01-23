// NSB_Booking/app/EditCircuit.tsx
// Screen for editing a circuit's details, rooms, and images.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';

type CircuitDetailsResponse = {
  message?: string;
  circuit: any;
  rooms: any[];
  images: any[];
};

type RoomForm = {
  room_Id?: number;
  room_Name: string;
  room_Count: string;
  max_Persons: string;
  price_per_person: string;
  description: string;
};

const NAVY = '#020038';
const YELLOW = '#FFB600';
const BLACK_BOX = '#050515';
const CARD = '#0A0A1A';
const MUTED = 'rgba(255,255,255,0.70)';
const MUTED2 = 'rgba(255,255,255,0.45)';

type SavingTarget = 'circuit' | 'rooms' | 'images' | null;

const toFullUrl = (p?: string) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return `${API_URL}${p}`;
};

const parseCommaImages = (txt: string) =>
  txt
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

async function getLoggedInUserId(): Promise<number | null> {
  const keys = ['user_id', 'userId', 'id'];
  for (const k of keys) {
    const v = await AsyncStorage.getItem(k);
    const n = v ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function buildAuthHeaders(extra: Record<string, string> = {}) {
  const userId = await getLoggedInUserId();
  if (!userId) return null;

  const base: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': String(userId),
    ...extra,
  };

  if (Platform.OS === 'web') base['Cache-Control'] = 'no-store';
  return base;
}

function appendImageToForm(form: FormData, fieldName: string, asset: any, fallbackName: string) {
  if (Platform.OS === 'web' && asset?.file) {
    const file: File = asset.file;
    form.append(fieldName, file, file.name || fallbackName);
    return;
  }

  form.append(
    fieldName,
    {
      uri: asset.uri,
      name: asset.fileName || fallbackName,
      type: asset.mimeType || 'image/jpeg',
    } as any
  );
}

const EditCircuitScreen = () => {
  const { circuitId } = useLocalSearchParams<{ circuitId?: string }>();

  const [loading, setLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState<SavingTarget>(null);

  const [circuitName, setCircuitName] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [originalImagePath, setOriginalImagePath] = useState('');

  const [rooms, setRooms] = useState<RoomForm[]>([]);
  const [imagesText, setImagesText] = useState('');

  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);

  const previewExtra = useMemo(() => parseCommaImages(imagesText), [imagesText]);

  const reloadFromServer = async () => {
    if (!circuitId) return;
    try {
      const res = await fetch(`${API_URL}/circuits/${circuitId}?t=${Date.now()}`, {
        headers: Platform.OS === 'web' ? { 'Cache-Control': 'no-store' } : undefined,
      });

      const json: CircuitDetailsResponse = await res.json().catch(() => ({
        circuit: null,
        rooms: [],
        images: [],
      }));

      if (!res.ok) return;

      const c = json.circuit;
      setCircuitName(c?.circuit_Name || '');
      setCity(c?.city || '');
      setStreet(c?.street || '');
      setImagePath(c?.imagePath || '');
      setOriginalImagePath(c?.imagePath || '');

      const rForms: RoomForm[] = (json.rooms || []).map((r) => ({
        room_Id: r.room_Id,
        room_Name: r.room_Name || '',
        room_Count: r.room_Count != null ? String(r.room_Count) : '',
        max_Persons: r.max_Persons != null ? String(r.max_Persons) : '',
        price_per_person: r.price_per_person != null ? String(r.price_per_person) : '',
        description: r.description || '',
      }));

      setRooms(
        rForms.length > 0
          ? rForms
          : [{ room_Name: '', room_Count: '1', max_Persons: '1', price_per_person: '0', description: '' }]
      );

      const imgPaths = (json.images || []).map((img) => img.imagePath || '');
      setImagesText(imgPaths.filter(Boolean).join(', '));
    } catch (err) {
      console.error('Error reloading from server:', err);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!circuitId) {
        setLoading(false);
        Alert.alert('Error', 'No circuit id provided.');
        return;
      }
      setLoading(true);
      await reloadFromServer();
      setLoading(false);
    };
    load();
  }, [circuitId]);

  const updateRoomField = (index: number, field: keyof RoomForm, value: string) => {
    setRooms((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addRoom = () => {
    setRooms((prev) => [
      ...prev,
      { room_Name: '', room_Count: '1', max_Persons: '1', price_per_person: '0', description: '' },
    ]);
  };

  const removeRoom = (index: number) => {
    if (rooms.length <= 1) {
      Alert.alert('Warning', 'Circuit must have at least one room type.');
      return;
    }
    setRooms((prev) => prev.filter((_, i) => i !== index));
  };

  const pickAndUploadMainImage = async () => {
    if (uploadingMain || savingTarget !== null) return;

    try {
      setUploadingMain(true);

      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Please allow gallery permission.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const form = new FormData();
      appendImageToForm(form, 'image', asset, `main_${Date.now()}.jpg`);

      const res = await fetch(`${API_URL}/circuits/upload/main`, { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        Alert.alert('Upload failed', json.message || 'Could not upload main image');
        return;
      }
      if (!json.imagePath) {
        Alert.alert('Upload failed', 'Server did not return imagePath');
        return;
      }

      setImagePath(json.imagePath);
      Alert.alert('Success', 'Main image uploaded. Click "Save Circuit Info" to apply changes.');
    } catch (err) {
      console.error('Main upload error:', err);
      Alert.alert('Error', 'Upload failed (cannot connect to server).');
    } finally {
      setUploadingMain(false);
    }
  };

  const pickAndUploadExtraImages = async () => {
    if (uploadingExtra || savingTarget !== null) return;

    try {
      setUploadingExtra(true);

      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Please allow gallery permission.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;

      const form = new FormData();
      result.assets.forEach((asset, idx) => {
        appendImageToForm(form, 'images', asset, `extra_${Date.now()}_${idx}.jpg`);
      });

      const res = await fetch(`${API_URL}/circuits/upload/extra`, { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        Alert.alert('Upload failed', json.message || 'Could not upload extra images');
        return;
      }

      const newPaths: string[] = Array.isArray(json.imagePaths) ? json.imagePaths : [];
      if (newPaths.length === 0) {
        Alert.alert('Upload', 'Upload finished but no image paths returned.');
        return;
      }

      const merged = Array.from(new Set([...previewExtra, ...newPaths]));
      setImagesText(merged.join(', '));
      Alert.alert('Success', `${newPaths.length} image(s) uploaded. Click "Save Extra Images" to apply changes.`);
    } catch (err) {
      console.error('Extra upload error:', err);
      Alert.alert('Error', 'Upload failed (cannot connect to server).');
    } finally {
      setUploadingExtra(false);
    }
  };

  const handleSaveCircuitInfo = async () => {
    if (!circuitId) return Alert.alert('Error', 'No circuit id provided.');
    if (!circuitName || !city || !street) {
      return Alert.alert('Error', 'Please fill circuit name, city and street.');
    }

    try {
      setSavingTarget('circuit');

      const headers = await buildAuthHeaders();
      if (!headers) {
        Alert.alert('Error', 'User id not found. Please login again.');
        return;
      }

      const res = await fetch(`${API_URL}/circuits/${circuitId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          circuit_Name: circuitName,
          city,
          street,
          imagePath: imagePath || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Error', json.message || 'Could not update circuit');
        return;
      }

      Alert.alert('Success', 'Circuit info updated successfully!');
      await reloadFromServer();
    } catch (err) {
      console.error('Save circuit error:', err);
      Alert.alert('Error', 'Cannot connect to server.');
    } finally {
      setSavingTarget(null);
    }
  };

  const handleSaveRooms = async () => {
    if (!circuitId) return Alert.alert('Error', 'No circuit id provided.');

    const cleaned = rooms
      .map((r) => ({
        room_Id: r.room_Id,
        room_Name: r.room_Name.trim(),
        room_Count: Number(r.room_Count) || 1,
        max_Persons: Number(r.max_Persons) || 1,
        price_per_person: Number(r.price_per_person) || 0,
        description: r.description.trim() || null,
      }))
      .filter((r) => r.room_Name.length > 0);

    if (cleaned.length === 0) return Alert.alert('Error', 'Please add at least one room type.');

    try {
      setSavingTarget('rooms');

      const headers = await buildAuthHeaders();
      if (!headers) {
        Alert.alert('Error', 'User id not found. Please login again.');
        return;
      }

      const res = await fetch(`${API_URL}/circuits/${circuitId}/rooms/replace`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rooms: cleaned }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Error', json.message || 'Could not update rooms');
        return;
      }

      Alert.alert('Success', 'Rooms updated successfully!');
      await reloadFromServer();
    } catch (err) {
      console.error('Save rooms error:', err);
      Alert.alert('Error', 'Cannot connect to server.');
    } finally {
      setSavingTarget(null);
    }
  };

  const handleSaveImages = async () => {
    if (!circuitId) return Alert.alert('Error', 'No circuit id provided.');

    const imagesArray = parseCommaImages(imagesText);

    try {
      setSavingTarget('images');

      const headers = await buildAuthHeaders();
      if (!headers) {
        Alert.alert('Error', 'User id not found. Please login again.');
        return;
      }

      const res = await fetch(`${API_URL}/circuits/${circuitId}/images/replace`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ images: imagesArray }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Error', json.message || 'Could not update images');
        return;
      }

      Alert.alert('Success', 'Extra images updated successfully!');
      await reloadFromServer();
    } catch (err) {
      console.error('Save images error:', err);
      Alert.alert('Error', 'Cannot connect to server.');
    } finally {
      setSavingTarget(null);
    }
  };

  const removeOneExtra = (idx: number) => {
    const updated = previewExtra.filter((_, i) => i !== idx);
    setImagesText(updated.join(', '));
  };

  const clearAllExtra = () => {
    setImagesText('');
    Alert.alert('Cleared', 'Extra images cleared. Click "Save Extra Images" to apply changes.');
  };

  const clearMainImageLocal = () => {
    setImagePath('');
    Alert.alert('Cleared', 'Main image cleared. Click "Save Circuit Info" to apply changes.');
  };

  const goBackToDetailsFresh = () => {
    if (!circuitId) return router.back();
    router.replace({
      pathname: '/CircuitDetails',
      params: { circuitId: String(circuitId), t: String(Date.now()) },
    });
  };

  if (loading) {
    return (
      <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={YELLOW} />
          <Text style={styles.loadingText}>Loading circuit...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      {/* ✅ Back button (same style as other screens) */}
      <TouchableOpacity style={styles.headerBack} onPress={goBackToDetailsFresh} activeOpacity={0.9}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ✅ Title header */}
      <View style={styles.header}>
        <Text style={styles.title}>Edit Circuit</Text>
        <Text style={styles.subtitle}>Update circuit info, rooms, and images</Text>
      </View>

      {/* ✅ IMPORTANT: style+background fixes the white pull-down area */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Circuit Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Circuit Info</Text>

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
                source={{ uri: toFullUrl(imagePath) }}
                style={styles.mainImage}
                resizeMode="cover"
              />
              <Text style={styles.hintText}>Path: {imagePath}</Text>
            </View>
          ) : (
            <Text style={styles.hintText}>No main image selected.</Text>
          )}

          <View style={styles.twoColRow}>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={pickAndUploadMainImage}
              disabled={uploadingMain || savingTarget !== null}
              activeOpacity={0.9}
            >
              {uploadingMain ? (
                <ActivityIndicator color={YELLOW} />
              ) : (
                <Text style={styles.btnOutlineText}>Pick & Upload Main</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnDanger}
              onPress={clearMainImageLocal}
              disabled={uploadingMain || savingTarget !== null || !imagePath}
              activeOpacity={0.9}
            >
              <Text style={styles.btnDangerText}>Clear Main</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, savingTarget !== null && styles.btnDisabled]}
            onPress={handleSaveCircuitInfo}
            disabled={savingTarget !== null}
            activeOpacity={0.9}
          >
            {savingTarget === 'circuit' ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Text style={styles.btnPrimaryText}>Save Circuit Info</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Rooms */}
        <View style={[styles.card, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Rooms</Text>
          <Text style={styles.hintText}>Note: Removing rooms here will deactivate them in the database.</Text>

          {rooms.map((room, index) => (
            <View key={index} style={styles.roomCard}>
              <View style={styles.roomHeaderRow}>
                <Text style={styles.roomHeader}>
                  Room {index + 1} {room.room_Id ? `(ID: ${room.room_Id})` : '(new)'}
                </Text>
                {rooms.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeRoom(index)}
                    disabled={savingTarget !== null}
                    style={styles.removeIconBtn}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FFB3B3" />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Room Name"
                placeholderTextColor={MUTED2}
                value={room.room_Name}
                onChangeText={(t) => updateRoomField(index, 'room_Name', t)}
              />
              <TextInput
                style={styles.input}
                placeholder="Room Count"
                placeholderTextColor={MUTED2}
                keyboardType="numeric"
                value={room.room_Count}
                onChangeText={(t) => updateRoomField(index, 'room_Count', t)}
              />
              <TextInput
                style={styles.input}
                placeholder="Max Persons"
                placeholderTextColor={MUTED2}
                keyboardType="numeric"
                value={room.max_Persons}
                onChangeText={(t) => updateRoomField(index, 'max_Persons', t)}
              />
              <TextInput
                style={styles.input}
                placeholder="Price per person"
                placeholderTextColor={MUTED2}
                keyboardType="numeric"
                value={room.price_per_person}
                onChangeText={(t) => updateRoomField(index, 'price_per_person', t)}
              />
              <TextInput
                style={[styles.input, { height: 76, paddingTop: 12 }]}
                placeholder="Description"
                placeholderTextColor={MUTED2}
                multiline
                value={room.description}
                onChangeText={(t) => updateRoomField(index, 'description', t)}
              />
            </View>
          ))}

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={addRoom}
            disabled={savingTarget !== null}
            activeOpacity={0.9}
          >
            <Text style={styles.linkBtnText}>+ Add Room Type</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrimary, savingTarget !== null && styles.btnDisabled]}
            onPress={handleSaveRooms}
            disabled={savingTarget !== null}
            activeOpacity={0.9}
          >
            {savingTarget === 'rooms' ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Text style={styles.btnPrimaryText}>Save Rooms</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Extra Images */}
        <View style={[styles.card, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Extra Images</Text>

          {previewExtra.length === 0 ? (
            <Text style={styles.hintText}>No extra images selected.</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {previewExtra.map((p, idx) => (
                <View key={`${p}_${idx}`} style={{ marginBottom: 12 }}>
                  <Image
                    source={{ uri: toFullUrl(p) }}
                    style={styles.extraImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.hintText} numberOfLines={1}>
                    {p}
                  </Text>

                  <TouchableOpacity
                    style={{ marginTop: 6, alignSelf: 'flex-end' }}
                    onPress={() => removeOneExtra(idx)}
                    disabled={savingTarget !== null}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.removeRoomText}>Remove this image</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.btnOutlineFull}
            onPress={pickAndUploadExtraImages}
            disabled={uploadingExtra || savingTarget !== null}
            activeOpacity={0.9}
          >
            {uploadingExtra ? (
              <ActivityIndicator color={YELLOW} />
            ) : (
              <Text style={styles.btnOutlineText}>Pick & Upload Extra Images</Text>
            )}
          </TouchableOpacity>

          <View style={styles.twoColRow}>
            <TouchableOpacity
              style={styles.btnDanger}
              onPress={clearAllExtra}
              disabled={savingTarget !== null || previewExtra.length === 0}
              activeOpacity={0.9}
            >
              <Text style={styles.btnDangerText}>Clear All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPrimary, savingTarget !== null && styles.btnDisabled, { marginTop: 0 }]}
              onPress={handleSaveImages}
              disabled={savingTarget !== null}
              activeOpacity={0.9}
            >
              {savingTarget === 'images' ? (
                <ActivityIndicator color={NAVY} />
              ) : (
                <Text style={styles.btnPrimaryText}>Save Extra Images</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>Extra Image Paths (auto-filled)</Text>
          <TextInput
            style={[styles.input, { height: 90, paddingTop: 12 }]}
            value={imagesText}
            onChangeText={setImagesText}
            placeholder="Extra image paths will appear here"
            placeholderTextColor={MUTED2}
            multiline
            editable={false}
          />
        </View>

        <View style={{ height: 26 }} />
      </ScrollView>
    </LinearGradient>
  );
};

export default EditCircuitScreen;

const styles = StyleSheet.create({
  background: { flex: 1 },

  // Fix white pull-down area: give scroll a dark/transparent base under gradient
  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: '7%',
    paddingTop: 140, // space for header+back
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

  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFFFFF', marginTop: 8 },

  card: {
    backgroundColor: 'rgba(10,10,26,0.88)',
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

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },

  label: {
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 10,
    fontWeight: '700',
  },

  // Keep your cream inputs? You said you want SignUp/AdminDashboard style,
  // so inputs are darker, glassy, with border.
  input: {
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
  },

  hintText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 4, fontWeight: '700' },

  mainImage: { width: '100%', height: 180, borderRadius: 14 },

  twoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },

  btnPrimary: {
    flex: 1,
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  btnPrimaryText: { color: NAVY, fontWeight: '900', fontSize: 15 },

  btnOutline: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.55)',
    backgroundColor: 'rgba(255,182,0,0.10)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnOutlineFull: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.55)',
    backgroundColor: 'rgba(255,182,0,0.10)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  btnOutlineText: { color: YELLOW, fontWeight: '900', fontSize: 13 },

  btnDanger: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,120,120,0.30)',
    backgroundColor: 'rgba(255,90,90,0.18)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDangerText: { color: '#FFB3B3', fontWeight: '900', fontSize: 13 },

  btnDisabled: { opacity: 0.7 },

  roomCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    padding: 12,
    marginTop: 10,
  },

  roomHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  roomHeader: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  removeIconBtn: { padding: 6 },

  linkBtn: { marginTop: 12, alignItems: 'center' },
  linkBtnText: { color: YELLOW, fontWeight: '900', fontSize: 14 },

  removeRoomText: { color: '#FFB3B3', fontSize: 13, fontWeight: '900' },

  extraImage: { width: '100%', height: 140, borderRadius: 14, marginTop: 6 },
});
