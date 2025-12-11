// app/EditCircuit.tsx
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

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
const CREAM = '#FFEBD3';
const BLACK_BOX = '#050515';

type SavingTarget = 'circuit' | 'rooms' | 'images' | null;

const EditCircuitScreen = () => {
  const { circuitId } = useLocalSearchParams<{ circuitId?: string }>();

  const [loading, setLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState<SavingTarget>(null);

  // circuit fields
  const [circuitName, setCircuitName] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [imagePath, setImagePath] = useState('');

  // rooms + images
  const [rooms, setRooms] = useState<RoomForm[]>([]);
  const [imagesText, setImagesText] = useState(''); // comma separated paths

  const API_URL =
    Platform.OS === 'web'
      ? 'http://localhost:3001'
      : 'http://192.168.8.111:3001';

  // Load existing circuit + rooms + images
  useEffect(() => {
    const load = async () => {
      if (!circuitId) {
        setLoading(false);
        Alert.alert('Error', 'No circuit id provided.');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/circuits/${circuitId}`);
        const json: CircuitDetailsResponse = await res.json();

        if (!res.ok) {
          console.log('Error loading circuit for edit:', json);
          Alert.alert('Error', json.message || 'Could not load circuit');
          setLoading(false);
          return;
        }

        const c = json.circuit;
        setCircuitName(c.circuit_Name || '');
        setCity(c.city || '');
        setStreet(c.street || '');
        setImagePath(c.imagePath || '');

        // existing rooms → keep room_Id
        const rForms: RoomForm[] = (json.rooms || []).map((r) => ({
          room_Id: r.room_Id,
          room_Name: r.room_Name || '',
          room_Count:
            r.room_Count !== undefined && r.room_Count !== null
              ? String(r.room_Count)
              : '',
          max_Persons:
            r.max_Persons !== undefined && r.max_Persons !== null
              ? String(r.max_Persons)
              : '',
          price_per_person:
            r.price_per_person !== undefined && r.price_per_person !== null
              ? String(r.price_per_person)
              : '',
          description: r.description || '',
        }));

        setRooms(
          rForms.length > 0
            ? rForms
            : [
                {
                  room_Name: '',
                  room_Count: '',
                  max_Persons: '',
                  price_per_person: '',
                  description: '',
                },
              ]
        );

        // existing images → comma separated
        const imgPaths = (json.images || []).map((img) => img.imagePath || '');
        setImagesText(imgPaths.filter(Boolean).join(', '));
      } catch (err) {
        console.log('Request error (load edit):', err);
        Alert.alert('Error', 'Cannot connect to server.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [circuitId]);

  // helpers for room editing
  const updateRoomField = (
    index: number,
    field: keyof RoomForm,
    value: string
  ) => {
    setRooms((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addRoom = () => {
    setRooms((prev) => [
      ...prev,
      {
        room_Name: '',
        room_Count: '',
        max_Persons: '',
        price_per_person: '',
        description: '',
      },
    ]);
  };

  // remove a room from state (backend will soft-delete)
  const removeRoom = (index: number) => {
    setRooms((prev) => prev.filter((_, i) => i !== index));
  };

  const goToDetails = () =>
    router.replace({
      pathname: '/CircuitDetails',
      params: { circuitId: String(circuitId) },
    });

  const stopSaving = () => setSavingTarget(null);

  //
  // 1) Save only circuit info (Circuits table)
  //
  const handleSaveCircuitInfo = async () => {
    if (!circuitId) {
      Alert.alert('Error', 'No circuit id provided.');
      return;
    }

    if (!circuitName || !city || !street) {
      Alert.alert('Error', 'Please fill circuit name, city and street.');
      return;
    }

    try {
      setSavingTarget('circuit');

      const resCircuit = await fetch(`${API_URL}/circuits/${circuitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circuit_Name: circuitName,
          city,
          street,
          imagePath,
        }),
      });

      const jsonCircuit = await resCircuit.json();
      if (!resCircuit.ok) {
        console.log('Error updating circuit:', jsonCircuit);
        Alert.alert('Error', jsonCircuit.message || 'Could not update circuit');
        stopSaving();
        return;
      }

      if (Platform.OS === 'web') {
        stopSaving();
        Alert.alert('Updated', 'Circuit info updated successfully.');
        goToDetails();
      } else {
        Alert.alert('Updated', 'Circuit info updated successfully.', [
          {
            text: 'OK',
            onPress: () => {
              stopSaving();
              goToDetails();
            },
          },
        ]);
      }
    } catch (err) {
      console.log('Request error (update circuit):', err);
      stopSaving();
      Alert.alert('Error', 'Cannot connect to server.');
    }
  };

  //
  // 2) Save only rooms (CircuitRooms table)
  //
  const handleSaveRooms = async () => {
    if (!circuitId) {
      Alert.alert('Error', 'No circuit id provided.');
      return;
    }

    // clean/validate rooms
    const cleanedRooms = rooms
      .map((r) => ({
        room_Id: r.room_Id,
        room_Name: r.room_Name.trim(),
        room_Count: r.room_Count.trim(),
        max_Persons: r.max_Persons.trim(),
        price_per_person: r.price_per_person.trim(),
        description: r.description.trim(),
      }))
      .filter((r) => r.room_Name.length > 0);

    if (cleanedRooms.length === 0) {
      Alert.alert('Error', 'Please add at least one room type.');
      return;
    }

    try {
      setSavingTarget('rooms');

      const roomsPayload = cleanedRooms.map((r) => ({
        room_Id: r.room_Id,
        room_Name: r.room_Name,
        room_Count: Number(r.room_Count) || 1,
        max_Persons: Number(r.max_Persons) || 1,
        price_per_person: Number(r.price_per_person) || 0,
        description: r.description || null,
      }));

      const resRooms = await fetch(
        `${API_URL}/circuits/${circuitId}/rooms/replace`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rooms: roomsPayload,
            createdBy: 1, // TODO: use logged-in user id
          }),
        }
      );

      const jsonRooms = await resRooms.json();
      if (!resRooms.ok) {
        console.log('Error updating rooms:', jsonRooms);
        Alert.alert('Error', jsonRooms.message || 'Could not update rooms');
        stopSaving();
        return;
      }

      if (Platform.OS === 'web') {
        stopSaving();
        Alert.alert('Updated', 'Rooms updated successfully.');
        goToDetails();
      } else {
        Alert.alert('Updated', 'Rooms updated successfully.', [
          {
            text: 'OK',
            onPress: () => {
              stopSaving();
              goToDetails();
            },
          },
        ]);
      }
    } catch (err) {
      console.log('Request error (update rooms):', err);
      stopSaving();
      Alert.alert('Error', 'Cannot connect to server.');
    }
  };

  //
  // 3) Save only extra images (CircuitImages table)
  //
  const handleSaveImages = async () => {
    if (!circuitId) {
      Alert.alert('Error', 'No circuit id provided.');
      return;
    }

    const imagesArray = imagesText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      setSavingTarget('images');

      const resImages = await fetch(
        `${API_URL}/circuits/${circuitId}/images/replace`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: imagesArray,
            createdBy: 1, // TODO: logged-in user
          }),
        }
      );

      const jsonImages = await resImages.json();
      if (!resImages.ok) {
        console.log('Error updating images:', jsonImages);
        Alert.alert('Error', jsonImages.message || 'Could not update images');
        stopSaving();
        return;
      }

      if (Platform.OS === 'web') {
        stopSaving();
        Alert.alert('Updated', 'Images updated successfully.');
        goToDetails();
      } else {
        Alert.alert('Updated', 'Images updated successfully.', [
          {
            text: 'OK',
            onPress: () => {
              stopSaving();
              goToDetails();
            },
          },
        ]);
      }
    } catch (err) {
      console.log('Request error (update images):', err);
      stopSaving();
      Alert.alert('Error', 'Cannot connect to server.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={YELLOW} />
        <Text style={styles.loadingText}>Loading circuit...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Edit Circuit</Text>

      <View style={styles.card}>
        {/* Circuit fields */}
        <Text style={styles.sectionTitle}>Circuit Info</Text>

        <Text style={styles.label}>Circuit Name</Text>
        <TextInput
          style={styles.input}
          value={circuitName}
          onChangeText={setCircuitName}
          placeholder="Circuit Name"
          placeholderTextColor="#8F8478"
        />

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="City"
          placeholderTextColor="#8F8478"
        />

        <Text style={styles.label}>Street</Text>
        <TextInput
          style={styles.input}
          value={street}
          onChangeText={setStreet}
          placeholder="Street"
          placeholderTextColor="#8F8478"
        />

        <Text style={styles.label}>Main Image Path</Text>
        <TextInput
          style={styles.input}
          value={imagePath}
          onChangeText={setImagePath}
          placeholder="Main Image Path"
          placeholderTextColor="#8F8478"
        />

        {/* Save circuit info only */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveCircuitInfo}
          disabled={savingTarget !== null}
        >
          <Text style={styles.saveButtonText}>
            {savingTarget === 'circuit' ? 'Saving...' : 'Save Circuit Info'}
          </Text>
        </TouchableOpacity>

        {/* Rooms section */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
          Rooms
        </Text>

        {rooms.map((room, index) => (
          <View key={index} style={styles.roomCard}>
            <Text style={styles.roomHeader}>
              Room {index + 1}{' '}
              {room.room_Id ? `(ID: ${room.room_Id})` : '(new)'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Room Name (eg: A, B, Family Room)"
              placeholderTextColor="#8F8478"
              value={room.room_Name}
              onChangeText={(text) =>
                updateRoomField(index, 'room_Name', text)
              }
            />

            <TextInput
              style={styles.input}
              placeholder="Room Count"
              placeholderTextColor="#8F8478"
              keyboardType="numeric"
              value={room.room_Count}
              onChangeText={(text) =>
                updateRoomField(index, 'room_Count', text)
              }
            />

            <TextInput
              style={styles.input}
              placeholder="Max Persons"
              placeholderTextColor="#8F8478"
              keyboardType="numeric"
              value={room.max_Persons}
              onChangeText={(text) =>
                updateRoomField(index, 'max_Persons', text)
              }
            />

            <TextInput
              style={styles.input}
              placeholder="Price per person"
              placeholderTextColor="#8F8478"
              keyboardType="numeric"
              value={room.price_per_person}
              onChangeText={(text) =>
                updateRoomField(index, 'price_per_person', text)
              }
            />

            <TextInput
              style={[styles.input, { height: 70 }]}
              placeholder="Description"
              placeholderTextColor="#8F8478"
              multiline
              value={room.description}
              onChangeText={(text) =>
                updateRoomField(index, 'description', text)
              }
            />

            {/* Remove room button */}
            <TouchableOpacity
              style={styles.removeRoomButton}
              onPress={() => removeRoom(index)}
              disabled={savingTarget !== null}
            >
              <Text style={styles.removeRoomText}>Remove this room</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addRoomButton}
          onPress={addRoom}
          disabled={savingTarget !== null}
        >
          <Text style={styles.addRoomText}>+ Add Room Type</Text>
        </TouchableOpacity>

        {/* Save rooms only */}
        <TouchableOpacity
          style={[styles.saveButton, { marginTop: 12 }]}
          onPress={handleSaveRooms}
          disabled={savingTarget !== null}
        >
          <Text style={styles.saveButtonText}>
            {savingTarget === 'rooms' ? 'Saving...' : 'Save Rooms'}
          </Text>
        </TouchableOpacity>

        {/* Images section */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
          Extra Images
        </Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={imagesText}
          onChangeText={setImagesText}
          placeholder="Image paths separated by commas (img1.jpg, img2.jpg)"
          placeholderTextColor="#8F8478"
          multiline
        />

        {/* Save images only */}
        <TouchableOpacity
          style={[styles.saveButton, { marginTop: 12 }]}
          onPress={handleSaveImages}
          disabled={savingTarget !== null}
        >
          <Text style={styles.saveButtonText}>
            {savingTarget === 'images' ? 'Saving...' : 'Save Extra Images'}
          </Text>
        </TouchableOpacity>

        {savingTarget !== null && (
          <ActivityIndicator style={{ marginTop: 10 }} color={NAVY} />
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={savingTarget !== null}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default EditCircuitScreen;

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: NAVY,
    paddingHorizontal: '6%',
    paddingTop: 40,
    paddingBottom: 30,
  },
  center: {
    flex: 1,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    width: '100%',
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 4,
  },
  input: {
    backgroundColor: CREAM,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  roomCard: {
    backgroundColor: '#171422',
    borderRadius: 14,
    padding: 10,
    marginTop: 8,
  },
  roomHeader: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 6,
    fontSize: 14,
  },
  addRoomButton: {
    marginTop: 8,
    alignItems: 'center',
  },
  addRoomText: {
    color: YELLOW,
    fontWeight: '600',
    fontSize: 14,
  },
  removeRoomButton: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  removeRoomText: {
    color: '#FFB3B3',
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: NAVY,
    fontWeight: '700',
    fontSize: 15,
  },
  cancelButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: YELLOW,
    fontWeight: '600',
    fontSize: 14,
  },
});
