import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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

const ManageCircuitsScreen = () => {
  // circuit fields
  const [circuitName, setCircuitName] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [imagePath, setImagePath] = useState('');

  // current room form fields
  const [roomName, setRoomName] = useState('');
  const [roomCount, setRoomCount] = useState('');
  const [maxPersons, setMaxPersons] = useState('');
  const [pricePerPerson, setPricePerPerson] = useState('');
  const [description, setDescription] = useState('');

  // all added room types
  const [rooms, setRooms] = useState<RoomPayload[]>([]);

  // extra images (comma separated)
  const [extraImages, setExtraImages] = useState('');

  const [loading, setLoading] = useState(false);

  // circuits list
  const [circuits, setCircuits] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Load circuits from API
  const fetchCircuits = async () => {
    try {
      setListLoading(true);
      const res = await fetch(`${API_URL}/circuits`);
      const data = await res.json();
      setCircuits(data);
    } catch (err) {
      console.log('Error loading circuits:', err);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchCircuits();
  }, []);

  // Add current room fields into rooms array
  const handleAddRoomType = () => {
    console.log('DEBUG: handleAddRoomType clicked');

    if (!roomName || !maxPersons || !pricePerPerson) {
      Alert.alert(
        'Error',
        'Please fill room name, max persons and price per person.'
      );
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

    // clear current room fields
    setRoomName('');
    setRoomCount('');
    setMaxPersons('');
    setPricePerPerson('');
    setDescription('');
  };

  const handleSave = async () => {
    console.log('DEBUG: handleSave called');
    console.log('DEBUG: circuitName=', circuitName);
    console.log('DEBUG: city=', city);
    console.log('DEBUG: street=', street);
    console.log('DEBUG: rooms.length=', rooms.length);

    if (!circuitName || !city || !street) {
      console.log('DEBUG: validation failed – missing circuit fields');
      Alert.alert('Error', 'Please fill circuit name, city and street.');
      return;
    }

    if (rooms.length === 0) {
      console.log('DEBUG: validation failed – no rooms added');
      Alert.alert(
        'Error',
        'Please add at least one room type before saving the circuit.'
      );
      return;
    }

    console.log('DEBUG: passing validation, sending POST /circuits...');
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
          createdBy: 1, // TODO: logged-in user
          rooms,
          imagesText: extraImages,
        }),
      });

      console.log('DEBUG: /circuits status =', response.status);

      const data = await response.json().catch((e) => {
        console.log('DEBUG: JSON parse error in handleSave', e);
        return {};
      });

      setLoading(false);

      if (!response.ok) {
        console.log('DEBUG: /circuits error payload =', data);
        Alert.alert('Error', data.message || 'Something went wrong');
        return;
      }

      Alert.alert('Success', 'Circuit, rooms and images saved successfully!');

      // Clear fields
      setCircuitName('');
      setCity('');
      setStreet('');
      setImagePath('');
      setRoomName('');
      setRoomCount('');
      setMaxPersons('');
      setPricePerPerson('');
      setDescription('');
      setRooms([]);
      setExtraImages('');

      // Reload circuit list
      fetchCircuits();
    } catch (err) {
      setLoading(false);
      console.log('DEBUG: request error in handleSave', err);
      Alert.alert('Error', 'Cannot connect to server.');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back arrow */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            console.log('DEBUG: Back button pressed');
            Alert.alert('DEBUG', 'Back button pressed'); // TEMP: ensure press fires
            router.push('/AdminDashboard'); // go to AdminDashboard route
          }}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Manage Circuit Bungalows</Text>

      {/* Add Circuit */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add New Circuit</Text>

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

        {/* Room fields */}
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
          Add Room Types
        </Text>

        <Text style={styles.label}>Room Name</Text>
        <TextInput
          style={styles.input}
          value={roomName}
          onChangeText={setRoomName}
          placeholder="Room Name (e.g. Type A, Family Room)"
          placeholderTextColor="#8F8478"
        />

        <Text style={styles.label}>Room Count</Text>
        <TextInput
          style={styles.input}
          value={roomCount}
          onChangeText={setRoomCount}
          placeholder="Room Count (e.g. 2)"
          placeholderTextColor="#8F8478"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Max Persons</Text>
        <TextInput
          style={styles.input}
          value={maxPersons}
          onChangeText={setMaxPersons}
          placeholder="Max Persons (e.g. 6)"
          placeholderTextColor="#8F8478"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Price Per Person</Text>
        <TextInput
          style={styles.input}
          value={pricePerPerson}
          onChangeText={setPricePerPerson}
          placeholder="Price per person (e.g. 5000)"
          placeholderTextColor="#8F8478"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor="#8F8478"
          multiline
        />

        {/* ADD ROOM BUTTON */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleAddRoomType}
        >
          <Text style={styles.secondaryButtonText}>+ Add Room Type</Text>
        </TouchableOpacity>

        {/* Show added rooms */}
        {rooms.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.subHeader}>Added Room Types</Text>
            {rooms.map((r, index) => (
              <View key={index} style={styles.roomChip}>
                <Text style={styles.roomChipTitle}>{r.room_Name}</Text>
                <Text style={styles.roomChipText}>
                  Count: {r.room_Count} | Max: {r.max_Persons} | Rs.{' '}
                  {r.price_per_person}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Extra images */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
          Extra Images
        </Text>
        <Text style={styles.label}>Image Paths</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={extraImages}
          onChangeText={setExtraImages}
          placeholder="Extra image paths, separated by commas"
          placeholderTextColor="#8F8478"
          multiline
        />

        {/* SAVE BUTTON with extra debug alert */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            console.log('DEBUG: Save button pressed');
            Alert.alert('DEBUG', 'Save button pressed');
            handleSave();
          }}
        >
          {loading ? (
            <ActivityIndicator color={NAVY} />
          ) : (
            <Text style={styles.buttonText}>
              Save Circuit + Rooms + Images
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Existing circuits */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Existing Circuits</Text>

        {listLoading && <ActivityIndicator color="#fff" />}

        {circuits.length === 0 && !listLoading && (
          <Text style={styles.emptyText}>No circuits yet.</Text>
        )}

        {circuits.map((circuit) => (
          <TouchableOpacity
            key={circuit.circuit_Id}
            style={styles.cardSmall}
            onPress={() =>
              router.push({
                pathname: '/CircuitDetails',
                params: { circuitId: String(circuit.circuit_Id) },
              })
            }
          >
            <Text style={styles.cardTitle}>{circuit.circuit_Name}</Text>
            <Text style={styles.cardLine}>
              {circuit.city} • {circuit.street}
            </Text>
            {circuit.imagePath && (
              <Text style={styles.cardLineSmall}>
                Main image: {circuit.imagePath}
              </Text>
            )}
            <Text style={styles.cardLineSmall}>
              ID: {circuit.circuit_Id} | Active:{' '}
              {circuit.is_active ? 'Yes' : 'No'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

export default ManageCircuitsScreen;

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: NAVY,
    paddingHorizontal: '6%',
    paddingTop: 40,
    paddingBottom: 30,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  topRow: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10, // make sure it's on top and clickable
  },
  backButton: {
    padding: 4,
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
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  subHeader: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  button: {
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: NAVY,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#2B2735',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: {
    color: YELLOW,
    fontWeight: '600',
    fontSize: 14,
  },
  roomChip: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    backgroundColor: '#171422',
  },
  roomChipTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  roomChipText: {
    color: '#D6D0C6',
    fontSize: 12,
  },
  listSection: {
    marginTop: 20,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  cardSmall: {
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
    color: '#E0DBD3',
    fontSize: 13,
  },
  cardLineSmall: {
    color: '#B8B0A5',
    fontSize: 12,
    marginTop: 2,
  },
});
