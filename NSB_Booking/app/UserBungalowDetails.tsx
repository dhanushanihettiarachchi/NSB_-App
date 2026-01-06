// app/UserBungalowDetails.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from './config';

type CircuitDetailsResponse = {
  message?: string;
  circuit?: any;
  rooms?: any[];
  images?: any[];
};

const NAVY = '#020038';
const CREAM = '#FFEBD3';
const BLACK_BOX = '#050515';



const { width: SCREEN_W } = Dimensions.get('window');
const GALLERY_H = 230;

const UserBungalowDetailsScreen = () => {
  const params = useLocalSearchParams();
  const circuitId =
    (params.circuitId as string) ||
    (params.id as string) ||
    (params.circuit_Id as string);

  const [data, setData] = useState<CircuitDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ✅ helper: DB path -> full URL
  const buildImageUrl = (path?: string | null) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const normalized = path.startsWith('/') ? path.slice(1) : path;
    return `${API_URL}/${normalized}`;
  };

  useEffect(() => {
    const loadDetails = async () => {
      if (!circuitId) {
        setErrorMessage('No circuit id provided to details screen.');
        setLoading(false);
        return;
      }

      try {
        const url = `${API_URL}/circuits/${circuitId}`;
        const res = await fetch(url);
        const json: CircuitDetailsResponse = await res.json().catch(() => ({}));

        if (!res.ok) {
          setErrorMessage(json.message || `Server returned status ${res.status}`);
          setLoading(false);
          return;
        }

        if (!json?.circuit) {
          setErrorMessage('API did not return circuit data.');
          setLoading(false);
          return;
        }

        setData(json);
        setErrorMessage(null);
      } catch (err) {
        setErrorMessage('Cannot connect to server.');
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [circuitId]);

  // ✅ IMPORTANT: derive these BEFORE any early return
  const circuit = data?.circuit;
  const rooms = data?.rooms ?? [];
  const images = data?.images ?? [];

  // ✅ IMPORTANT: hooks must always run (even while loading)
  const gallery = useMemo(() => {
    const main = buildImageUrl(circuit?.imagePath);
    const extras = images
      .map((img: any) => buildImageUrl(img?.imagePath))
      .filter(Boolean) as string[];

    const all = [main, ...extras].filter(Boolean) as string[];
    return Array.from(new Set(all)); // remove duplicates
  }, [circuit?.imagePath, images]);

  // ===== Loading / Error =====
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading bungalow details...</Text>
      </View>
    );
  }

  if (!circuit) {
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Top back arrow */}
      <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ===== HERO CARD ===== */}
      <View style={styles.heroCard}>
        <Text style={styles.title}>{circuit.circuit_Name}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={18} color={CREAM} />
          <Text style={styles.locationText}>
            {circuit.city}
            {circuit.street ? ` • ${circuit.street}` : ''}
          </Text>
        </View>

        {/* ===== Image Gallery (Main + Extras) ===== */}
        {gallery.length > 0 ? (
          <ImageCarousel images={gallery} />
        ) : (
          <View style={styles.noImageBox}>
            <Ionicons name="image-outline" size={22} color="#B8B0A5" />
            <Text style={styles.noImageText}>No images available</Text>
          </View>
        )}
      </View>

      {/* ===== ROOMS ===== */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Rooms</Text>
        <Text style={styles.sectionHint}>
          {rooms.length > 0 ? `${rooms.length} available` : 'None available'}
        </Text>
      </View>

      {rooms.length === 0 ? (
        <Text style={styles.smallText}>No rooms found.</Text>
      ) : (
        rooms.map((room: any) => (
          <View key={room.room_Id} style={styles.roomCard}>
            <View style={styles.roomTopRow}>
              <Text style={styles.roomName}>{room.room_Name}</Text>
              {!!room.price_per_person && (
                <View style={styles.pricePill}>
                  <Text style={styles.priceText}>
                    Rs {room.price_per_person}
                    <Text style={styles.priceTextSmall}> /person</Text>
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.roomMetaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="grid-outline" size={16} color="#E0D9CE" />
                <Text style={styles.metaText}>Count: {room.room_Count}</Text>
              </View>

              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={16} color="#E0D9CE" />
                <Text style={styles.metaText}>Max: {room.max_Persons}</Text>
              </View>
            </View>

            {!!room.description && (
              <Text style={styles.roomDesc} numberOfLines={3}>
                {room.description}
              </Text>
            )}
          </View>
        ))
      )}

      {/* ===== Ready to Booking CTA ===== */}
<View style={styles.bookingCtaCard}>
  <Text style={styles.bookingCtaTitle}>Ready to book this bungalow?</Text>
  <Text style={styles.bookingCtaSub}>
    Select your room, dates and submit a booking request.
  </Text>

  <TouchableOpacity
    style={styles.bookingBtn}
    onPress={() =>
      router.push({
        pathname: '/Bookings',
        params: {
          circuitId: String(circuit.circuit_Id ?? circuit.circuitId ?? ''),
          circuitName: String(circuit.circuit_Name ?? ''),
          city: String(circuit.city ?? ''),
          street: String(circuit.street ?? ''),
        },
      })
    }
  >
    <Ionicons name="calendar-outline" size={18} color="#00113D" />
    <Text style={styles.bookingBtnText}>Add Booking</Text>
  </TouchableOpacity>
</View>

<TouchableOpacity onPress={() => router.back()} style={styles.backButtonBottom}>
  <Text style={styles.backText}>Back</Text>
</TouchableOpacity>

    </ScrollView>
  );
};

export default UserBungalowDetailsScreen;

/** ===============================
 *  Image Carousel (Swipe Gallery)
 *  =============================== */
function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(x / (SCREEN_W * 0.88));
    setIndex(Math.max(0, Math.min(images.length - 1, newIndex)));
  };

  return (
    <View style={styles.galleryWrap}>
      <FlatList
        ref={listRef}
        data={images}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        snapToInterval={SCREEN_W * 0.88}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <View style={styles.galleryItem}>
            <Image
              source={{ uri: item }}
              style={styles.galleryImage}
              resizeMode="cover"
            />
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {images.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === index ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

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
    paddingHorizontal: 16,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },
  headerBack: {
    position: 'absolute',
    top: 20,
    left: 16,
    zIndex: 10,
    padding: 4,
  },

  // ===== Hero Card =====
  heroCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 16,
    marginTop: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  locationText: {
    color: '#E2DCD2',
    fontSize: 14,
    fontWeight: '600',
  },

  // ===== Gallery =====
  galleryWrap: {
    marginTop: 6,
  },
  galleryItem: {
    width: SCREEN_W * 0.88,
    height: GALLERY_H,
    borderRadius: 14,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  dotActive: {
    backgroundColor: CREAM,
  },
  dotInactive: {
    backgroundColor: '#3B3658',
  },
  noImageBox: {
    height: GALLERY_H,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2C2750',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noImageText: {
    color: '#B8B0A5',
    fontSize: 13,
    fontStyle: 'italic',
  },

  // ===== Sections =====
  sectionHeader: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHint: {
    color: '#B8B0A5',
    fontSize: 12,
    fontStyle: 'italic',
  },
  smallText: {
    color: '#DDD3C8',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },

  // ===== Room cards =====
  roomCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  roomTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  roomName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  pricePill: {
    borderWidth: 1,
    borderColor: '#2C2750',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0A0830',
  },
  priceText: {
    color: CREAM,
    fontSize: 13,
    fontWeight: '800',
  },
  priceTextSmall: {
    fontSize: 11,
    fontWeight: '700',
  },
  roomMetaRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#E0D9CE',
    fontSize: 13,
    fontWeight: '600',
  },
  roomDesc: {
    color: '#B8B0A5',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },

  // ===== Back buttons =====
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
    fontWeight: '700',
    fontSize: 14,
  },
  bookingCtaCard: {
  backgroundColor: BLACK_BOX,
  borderRadius: 14,
  padding: 16,
  marginTop: 18,
  borderWidth: 1,
  borderColor: '#2C2750',
},
bookingCtaTitle: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '800',
},
bookingCtaSub: {
  color: '#B8B0A5',
  fontSize: 12,
  marginTop: 6,
  lineHeight: 16,
},
bookingBtn: {
  marginTop: 12,
  backgroundColor: '#FFB600', // ✅ same button color you use
  paddingVertical: 12,
  borderRadius: 10,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
},
bookingBtnText: {
  color: '#00113D', // ✅ same text color you use
  fontSize: 16,
  fontWeight: '700',
},


});
