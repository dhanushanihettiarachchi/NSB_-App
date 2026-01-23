// NSB_Booking/app/CircuitManage.tsx
// NSB Booking App - Manage Circuits Screen
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
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';

type RoomPayload = {
  room_Name: string;
  room_Count: number;
  max_Persons: number;
  price_per_person: number;
  description?: string;
};

const NAVY = '#020038';
const YELLOW = '#FFB600';
const CARD = '#0A0A1A';
const MUTED = 'rgba(255,255,255,0.70)';
const MUTED2 = 'rgba(255,255,255,0.45)';

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

type FocusField =
  | 'circuitName'
  | 'city'
  | 'street'
  | 'roomName'
  | 'roomCount'
  | 'maxPersons'
  | 'pricePerPerson'
  | 'description'
  | null;

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

  // ✅ keep existing logic (optional refresh)
  const [circuits, setCircuits] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [focusField, setFocusField] = useState<FocusField>(null);

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
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Back */}
        <TouchableOpacity style={styles.headerBack} onPress={() => router.push('/AdminDashboard')} activeOpacity={0.9}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Manage Circuit Bungalows</Text>
          <Text style={styles.subtitle}>Add circuit details, rooms, and images</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add New Circuit</Text>

          {/* Circuit Name */}
          <Text style={styles.label}>Circuit Name</Text>
          <View style={[styles.inputWrap, focusField === 'circuitName' && styles.inputFocus]}>
            <Ionicons name="home-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              value={circuitName}
              onChangeText={setCircuitName}
              placeholder="Circuit name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              onFocus={() => setFocusField('circuitName')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          {/* City */}
          <Text style={[styles.label, { marginTop: 12 }]}>City</Text>
          <View style={[styles.inputWrap, focusField === 'city' && styles.inputFocus]}>
            <Ionicons name="location-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="City"
              placeholderTextColor="rgba(255,255,255,0.35)"
              onFocus={() => setFocusField('city')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          {/* Street */}
          <Text style={[styles.label, { marginTop: 12 }]}>Street</Text>
          <View style={[styles.inputWrap, focusField === 'street' && styles.inputFocus]}>
            <Ionicons name="navigate-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              value={street}
              onChangeText={setStreet}
              placeholder="Street"
              placeholderTextColor="rgba(255,255,255,0.35)"
              onFocus={() => setFocusField('street')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          {/* Main image */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle2}>Main Image</Text>
            <View style={styles.pill}>
              <Ionicons name="image-outline" size={14} color={YELLOW} />
              <Text style={styles.pillText}>{imagePath ? 'Uploaded' : 'Not uploaded'}</Text>
            </View>
          </View>

          {imagePath ? (
            <View style={{ marginTop: 10 }}>
              <Image
                key={imagePath}
                source={{ uri: toFullUrl(imagePath) }}
                style={styles.previewMain}
                resizeMode="cover"
                onError={(e) => console.log('Main image load error:', e.nativeEvent)}
              />
              <Text style={styles.metaText}>Saved: {imagePath}</Text>
            </View>
          ) : (
            <Text style={styles.metaText}>No main image uploaded yet.</Text>
          )}

          <TouchableOpacity
            style={[styles.btnOutline, uploadingMain && styles.btnDisabled]}
            onPress={pickAndUploadMainImage}
            disabled={uploadingMain}
            activeOpacity={0.9}
          >
            {uploadingMain ? (
              <>
                <ActivityIndicator color={YELLOW} />
                <Text style={styles.btnOutlineText}> Uploading...</Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={YELLOW} />
                <Text style={styles.btnOutlineText}>Pick & Upload Main Image</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Room types */}
          <View style={[styles.divider, { marginTop: 18 }]} />
          <Text style={styles.sectionTitle}>Add Room Types</Text>

          <Text style={styles.label}>Room Name</Text>
          <View style={[styles.inputWrap, focusField === 'roomName' && styles.inputFocus]}>
            <Ionicons name="bed-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              value={roomName}
              onChangeText={setRoomName}
              placeholder="Room name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              onFocus={() => setFocusField('roomName')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Room Count</Text>
          <View style={[styles.inputWrap, focusField === 'roomCount' && styles.inputFocus]}>
            <Ionicons name="layers-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              value={roomCount}
              onChangeText={setRoomCount}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor="rgba(255,255,255,0.35)"
              onFocus={() => setFocusField('roomCount')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Max Persons Per One Room</Text>
          <View style={[styles.inputWrap, focusField === 'maxPersons' && styles.inputFocus]}>
            <Ionicons name="people-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              value={maxPersons}
              onChangeText={setMaxPersons}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor="rgba(255,255,255,0.35)"
              onFocus={() => setFocusField('maxPersons')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Price Per Person</Text>
          <View style={[styles.inputWrap, focusField === 'pricePerPerson' && styles.inputFocus]}>
            <Ionicons name="cash-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              value={pricePerPerson}
              onChangeText={setPricePerPerson}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.35)"
              onFocus={() => setFocusField('pricePerPerson')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Description</Text>
          <View style={[styles.inputWrapArea, focusField === 'description' && styles.inputFocus]}>
            <Ionicons name="document-text-outline" size={18} color={MUTED} />
            <TextInput
              style={[styles.input, { height: 84, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Optional description"
              placeholderTextColor="rgba(255,255,255,0.35)"
              onFocus={() => setFocusField('description')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          <TouchableOpacity style={styles.btnOutline} onPress={handleAddRoomType} activeOpacity={0.9}>
            <Ionicons name="add-circle-outline" size={18} color={YELLOW} />
            <Text style={styles.btnOutlineText}>Add Room Type</Text>
          </TouchableOpacity>

          {rooms.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.subHeader}>Added Room Types</Text>

              {rooms.map((r, index) => (
                <View key={index} style={styles.roomCard}>
                  <View style={styles.roomCardTop}>
                    <Text style={styles.roomTitle}>{r.room_Name}</Text>
                    <View style={styles.miniPill}>
                      <Ionicons name="pricetag-outline" size={13} color={YELLOW} />
                      <Text style={styles.miniPillText}>Rs {r.price_per_person}</Text>
                    </View>
                  </View>

                  <Text style={styles.roomMeta}>
                    Count: {r.room_Count}  •  Max: {r.max_Persons}
                  </Text>

                  {r.description ? (
                    <Text style={styles.roomDesc} numberOfLines={3}>
                      {r.description}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Extra images */}
          <View style={[styles.divider, { marginTop: 18 }]} />
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Extra Images</Text>
            <Text style={styles.smallCount}>
              {extraPreview.length ? `${extraPreview.length} selected` : '0 selected'}
            </Text>
          </View>

          {extraPreview.length > 0 ? (
            <Text style={styles.metaText}>Saved: {extraPreview.length} images</Text>
          ) : (
            <Text style={styles.metaText}>No extra images uploaded yet.</Text>
          )}

          <TouchableOpacity
            style={[styles.btnOutline, uploadingExtra && styles.btnDisabled]}
            onPress={pickAndUploadExtraImages}
            disabled={uploadingExtra}
            activeOpacity={0.9}
          >
            {uploadingExtra ? (
              <>
                <ActivityIndicator color={YELLOW} />
                <Text style={styles.btnOutlineText}> Uploading...</Text>
              </>
            ) : (
              <>
                <Ionicons name="images-outline" size={18} color={YELLOW} />
                <Text style={styles.btnOutlineText}>Pick & Upload Extra Images</Text>
              </>
            )}
          </TouchableOpacity>

          {extraPreview.length > 0 && (
            <View style={{ marginTop: 10 }}>
              {extraPreview.slice(0, 6).map((p, idx) => (
                <Image
                  key={p + idx}
                  source={{ uri: toFullUrl(p) }}
                  style={styles.previewExtra}
                  resizeMode="cover"
                />
              ))}
            </View>
          )}

          {/* Save */}
          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleSave}
            activeOpacity={0.9}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color={NAVY} />
                <Text style={styles.btnPrimaryText}> Saving...</Text>
              </>
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={NAVY} />
                <Text style={styles.btnPrimaryText}> Save Circuit + Rooms + Images</Text>
              </>
            )}
          </TouchableOpacity>

          {/* optional loading indicator (since fetchCircuits still exists) */}
          {listLoading ? <ActivityIndicator color="#fff" style={{ marginTop: 12 }} /> : null}
        </View>

        {/* ✅ Existing Circuits button (same logic, new style) */}
        <Pressable
          style={({ pressed }) => [styles.viewBtn, pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 }]}
          onPress={() => router.push('/ExistingCircuits')}
        >
          <View style={styles.viewBtnIcon}>
            <Ionicons name="list-outline" size={18} color={YELLOW} />
          </View>
          <Text style={styles.viewBtnText}>View Existing Circuits</Text>
          <View style={styles.chevPill}>
            <Ionicons name="chevron-forward" size={18} color={YELLOW} />
          </View>
        </Pressable>

        <View style={{ height: 26 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },

  screen: {
    flexGrow: 1,
    paddingHorizontal: '7%',
    paddingTop: 90,
    paddingBottom: 30,
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

  header: {
    alignItems: 'center',
    marginBottom: 16,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },

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

  sectionTitle2: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  label: {
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '700',
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  inputWrapArea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  inputFocus: {
    borderColor: YELLOW,
    backgroundColor: 'rgba(255,182,0,0.08)',
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: 14,
  },

  metaText: {
    color: MUTED2,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  previewMain: {
    width: '100%',
    height: 170,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  previewExtra: {
    width: '100%',
    height: 120,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  btnOutline: {
    marginTop: 10,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  btnOutlineText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },

  btnPrimary: {
    marginTop: 14,
    width: '100%',
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  btnPrimaryText: {
    color: NAVY,
    fontWeight: '900',
    fontSize: 14,
  },

  btnDisabled: {
    opacity: 0.72,
  },

  subHeader: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },

  roomCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },

  roomCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  roomTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },

  roomMeta: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },

  roomDesc: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    lineHeight: 16,
  },

  miniPill: {
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

  miniPillText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  smallCount: {
    color: MUTED,
    fontWeight: '900',
    fontSize: 12,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  pillText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },

  viewBtn: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(10,10,26,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  viewBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,182,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewBtnText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  chevPill: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: 'rgba(255,182,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
