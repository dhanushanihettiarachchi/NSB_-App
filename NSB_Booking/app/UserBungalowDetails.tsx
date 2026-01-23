// app/UserBungalowDetails.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Alert,
  Pressable,
} from 'react-native';

import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';

type CircuitDetailsResponse = {
  message?: string;
  circuit?: any;
  rooms?: any[];
  images?: any[];
};

const NAVY = '#020038';
const CREAM = '#FFEBD3';
const BLACK_BOX = '#050515';
const GOLD = '#FFB600'
const SOFT_TEXT = '#CFC7BD';
const LINE = 'rgba(255,255,255,0.08)';
const CHIP_BG = '#0A0830';


const { width: SCREEN_W } = Dimensions.get('window');
const GALLERY_H = 240;

const UserBungalowDetailsScreen = () => {
  const params = useLocalSearchParams();

  const circuitId =
    (params.circuitId as string) ||
    (params.id as string) ||
    (params.circuit_Id as string);

  // ✅ NEW: get userId from params (forward it to Bookings)
  const userId = String(params.userId ?? '');

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
        <Text style={styles.loadingText}>{errorMessage || 'Details not available.'}</Text>
      </View>
    );
  }

  const goToBookings = () => {
    // ✅ Guard: userId must exist, otherwise backend will reject booking
    if (!userId) {
      Alert.alert('User not found', 'UserId is missing. Please login again and open this page.');
      return;
    }

    router.push({
      pathname: '/Bookings',
      params: {
        circuitId: String(circuit.circuit_Id ?? circuit.circuitId ?? ''),
        circuitName: String(circuit.circuit_Name ?? ''),
        city: String(circuit.city ?? ''),
        street: String(circuit.street ?? ''),
        userId: userId, // ✅ fixed (no loggedUser)
      },
    });
  };

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Back Arrow */}
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* ===== HERO / TITLE CARD ===== */}
        <View style={styles.heroCard}>
          <Text style={styles.title}>{circuit.circuit_Name}</Text>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={18} color={CREAM} />
            <Text style={styles.locationText}>
              {circuit.city}
              {circuit.street ? ` • ${circuit.street}` : ''}
            </Text>
          </View>

          {/* Gallery */}
          {gallery.length > 0 ? (
            <ImageCarousel images={gallery} />
          ) : (
            <View style={styles.noImageBox}>
              <Ionicons name="image-outline" size={22} color="#B8B0A5" />
              <Text style={styles.noImageText}>No images available</Text>
            </View>
          )}
        </View>

        {/* ===== ROOMS HEADER ===== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rooms</Text>

          {/* ✅ Icon becomes "bold" (filled Ionicon) on hover/press */}
          <IconChip
            iconOutline="bed-outline"
            iconBold="bed"
            text={rooms.length > 0 ? `${rooms.length} available` : 'None'}
          />
        </View>

        {/* ===== ROOMS LIST ===== */}
        {rooms.length === 0 ? (
          <Text style={styles.smallText}>No rooms found.</Text>
        ) : (
          rooms.map((room: any) => (
            <View key={room.room_Id} style={styles.roomCard}>
              <View style={styles.roomHeader}>
                <View style={styles.roomTitleRow}>
                  {/* ✅ icon: NO background by default, GOLD background only on hover/press */}
                  <IconSquare
                    iconOutline="bed-outline"
                    iconBold="bed"
                    size={18}
                    idleColor={GOLD}
                  />
                  <Text style={styles.roomName}>{room.room_Name}</Text>
                </View>

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
                <IconChip iconOutline="grid-outline" iconBold="grid" text={`Count: ${room.room_Count}`} />
                <IconChip
                  iconOutline="people-outline"
                  iconBold="people"
                  text={`Max: ${room.max_Persons}`}
                />
              </View>

              {!!room.description && (
                <Text style={styles.roomDesc} numberOfLines={4}>
                  {room.description}
                </Text>
              )}
            </View>
          ))
        )}

        {/* ===== BOOKING CTA ===== */}
        <View style={styles.bookingCtaCard}>
          <View style={styles.bookingCtaTop}>
            {/* ✅ icon: NO background by default, GOLD background only on hover/press */}
            <IconSquare
              iconOutline="calendar-outline"
              iconBold="calendar"
              size={18}
              idleColor={GOLD}
            />

            <View style={{ flex: 1 }}>
              <Text style={styles.bookingCtaTitle}>Ready to book?</Text>
              <Text style={styles.bookingCtaSub}>Select room, dates and submit your request.</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.bookingBtn} onPress={goToBookings} activeOpacity={0.9}>
            <Text style={styles.bookingBtnText}>Add Booking</Text>
            <Ionicons name="chevron-forward" size={18} color={NAVY} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

export default UserBungalowDetailsScreen;

/** ===============================
 *  IconChip: icon becomes "bold"
 *  (filled Ionicon) on hover/press
 *  =============================== */
function IconChip({
  iconOutline,
  iconBold,
  text,
}: {
  iconOutline: keyof typeof Ionicons.glyphMap;
  iconBold: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.metaChip,
        (hovered || pressed) && styles.metaChipActive,
      ]}
    >
      {({ pressed }) => {
        const active = hovered || pressed;
        return (
          <>
            <Ionicons name={active ? iconBold : iconOutline} size={15} color={active ? GOLD : SOFT_TEXT} />
            <Text style={[styles.metaText, active && styles.metaTextActive]}>{text}</Text>
          </>
        );
      }}
    </Pressable>
  );
}

/** =====================================================
 *  IconSquare: outlined square icon (idle),
 *  becomes filled GOLD background on hover/press
 *  (same behavior as UserBungalows list icon)
 *  ===================================================== */
function IconSquare({
  iconOutline,
  iconBold,
  size,
  idleColor,
}: {
  iconOutline: keyof typeof Ionicons.glyphMap;
  iconBold: keyof typeof Ionicons.glyphMap;
  size: number;
  idleColor: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => {
        const active = hovered || pressed;
        return [styles.squareIconBase, active ? styles.squareIconActive : styles.squareIconIdle];
      }}
    >
      {({ pressed }) => {
        const active = hovered || pressed;
        return (
          <Ionicons
            name={active ? iconBold : iconOutline}
            size={size}
            color={active ? NAVY : idleColor}
          />
        );
      }}
    </Pressable>
  );
}

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
        contentContainerStyle={{ gap: 10, paddingHorizontal: 2 }}
        renderItem={({ item }) => (
          <View style={styles.galleryItem}>
            <Image source={{ uri: item }} style={styles.galleryImage} resizeMode="cover" />
            <View style={styles.galleryOverlay}>
              <View style={styles.galleryBadge}>
                <Ionicons name="images-outline" size={14} color={NAVY} />
                <Text style={styles.galleryBadgeText}>Gallery</Text>
              </View>
            </View>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {images.map((_, i) => (
          <View key={i} style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: '6%',
    paddingTop: 80,
    paddingBottom: 40,
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
    marginTop: 10,
    textAlign: 'center',
    opacity: 0.9,
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


  // ===== Hero Card =====
  heroCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: LINE,
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
    marginBottom: 14,
  },

  locationText: {
    color: '#E2DCD2',
    fontSize: 13,
    fontWeight: '600',
  },

  // ===== Gallery =====
  galleryWrap: {
    marginTop: 6,
  },

  galleryItem: {
    width: SCREEN_W * 0.88,
    height: GALLERY_H,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  galleryImage: {
    width: '100%',
    height: '100%',
  },

  galleryOverlay: {
    position: 'absolute',
    left: 12,
    top: 12,
  },

  galleryBadge: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  galleryBadgeText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: '800',
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  smallText: {
    color: '#DDD3C8',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 10,
  },

  // ===== Room cards =====
  roomCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  // (kept for layout compatibility; no longer used directly)
  roomIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: GOLD,
    justifyContent: 'center',
    alignItems: 'center',
  },

  roomName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },

  pricePill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: CHIP_BG,
  },

  priceText: {
    color: CREAM,
    fontSize: 13,
    fontWeight: '900',
  },

  priceTextSmall: {
    fontSize: 11,
    fontWeight: '800',
  },

  roomMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },

  // ✅ used by IconChip
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  metaChipActive: {
    borderColor: 'rgba(255,200,87,0.40)',
    backgroundColor: 'rgba(255,200,87,0.08)',
    transform: [{ scale: 1.02 }],
  },
  metaText: {
    color: SOFT_TEXT,
    fontSize: 12,
    fontWeight: '700',
  },
  metaTextActive: {
    color: CREAM,
  },

  roomDesc: {
    color: '#B8B0A5',
    fontSize: 12,
    marginTop: 10,
    lineHeight: 17,
  },

  // ===== Booking CTA =====
  bookingCtaCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: LINE,
  },

  bookingCtaTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  // (kept for compatibility; no longer used directly)
  bookingCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: GOLD,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bookingCtaTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  bookingCtaSub: {
    color: '#B8B0A5',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },

  bookingBtn: {
    marginTop: 14,
    backgroundColor: GOLD,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },

  bookingBtnText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '900',
  },

  // ===== Square Icon (idle vs active) =====
  squareIconBase: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareIconIdle: {
    borderWidth: 1,
    borderColor: 'rgba(255,200,87,0.65)',
    backgroundColor: 'transparent',
  },
  squareIconActive: {
    backgroundColor: GOLD,
  },
});
