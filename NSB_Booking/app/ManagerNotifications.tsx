// NSB_Booking/app/ManagerNotifications.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';

const NAVY = '#020038';
const YELLOW = '#FFB600';
const MUTED = 'rgba(255,255,255,0.70)';
const MUTED2 = 'rgba(255,255,255,0.45)';
const CARD_BG = 'rgba(10,10,26,0.88)';

function safeDate(d: any) {
  if (!d) return '-';
  return String(d).slice(0, 10);
}
function safeTime(t: any) {
  if (!t) return '-';
  const s = String(t);
  if (s.includes('T')) return s.split('T')[1]?.slice(0, 5) || '-';
  if (s.length >= 5) return s.slice(0, 5);
  return s;
}

export default function ManagerNotifications() {
  const params = useLocalSearchParams();
  const userId = String(params.userId ?? '');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [bookings, setBookings] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/bookings/manager-notifications?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data.message || 'Failed to load notifications');
        setBookings([]);
        return;
      }

      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load notifications');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDetails = (item: any) => {
    setSelected(item);
    setDetailsVisible(true);
  };

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>Approved bookings for your circuit</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={YELLOW} size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          data={bookings}
          keyExtractor={(i) => String(i.booking_id)}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.95, transform: [{ scale: 0.995 }] },
              ]}
              onPress={() => openDetails(item)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.circuit_Name || item.room_Name || 'Booking'}
                  </Text>
                  <Text style={styles.subText} numberOfLines={1}>
                    Booking ID: {item.booking_id} {item.user_name ? `| User: ${item.user_name}` : `| User ID: ${item.user_id}`}
                  </Text>
                </View>

                <View style={styles.statusPill}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                  <Text style={styles.statusText}>Approved</Text>
                </View>
              </View>

              <View style={styles.rowLine}>
                <Ionicons name="calendar-outline" size={16} color={YELLOW} />
                <Text style={styles.rowText}>
                  {safeDate(item.check_in_date)} → {safeDate(item.check_out_date)}
                </Text>
              </View>

              <View style={styles.rowLine}>
                <Ionicons name="time-outline" size={16} color={YELLOW} />
                <Text style={styles.rowText}>{safeTime(item.booking_time)}</Text>
              </View>

              <View style={styles.rowLine}>
                <Ionicons name="people-outline" size={16} color={YELLOW} />
                <Text style={styles.rowText}>
                  Guests: {item.guest_count} • Rooms: {item.need_room_count}
                </Text>
              </View>

              <Text style={styles.queueText}>
                Approved at: {String(item.approved_date || item.updated_date || item.created_date || '').slice(0, 19).replace('T', ' ')}
              </Text>
            </Pressable>
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet</Text>}
        />
      )}

      {/* DETAILS MODAL */}
      <Modal visible={detailsVisible} animationType="slide" transparent={false}>
        <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.modalBg}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setDetailsVisible(false)} activeOpacity={0.9}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {selected && (
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selected.circuit_Name || selected.room_Name || 'Booking'}
                </Text>

                <View style={styles.modalDivider} />

                <InfoRow icon="key-outline" label="Booking ID" value={String(selected.booking_id)} />
                <InfoRow icon="person-outline" label="User" value={selected.user_name || `User ID ${selected.user_id}`} />
                <InfoRow icon="calendar-outline" label="Check-in" value={safeDate(selected.check_in_date)} />
                <InfoRow icon="calendar-outline" label="Check-out" value={safeDate(selected.check_out_date)} />
                <InfoRow icon="time-outline" label="Time" value={safeTime(selected.booking_time)} />
                <InfoRow icon="people-outline" label="Guests" value={String(selected.guest_count || '-')} />
                <InfoRow icon="home-outline" label="Rooms" value={String(selected.need_room_count || '-')} />
                <InfoRow icon="information-circle-outline" label="Purpose" value={selected.purpose || '-'} />
                <InfoRow icon="shield-checkmark-outline" label="Status" value={selected.status || 'Approved'} />
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={YELLOW} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },

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

  title: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: '7%' },
  loadingText: { color: '#fff', marginTop: 10, fontWeight: '700' },

  listContent: { paddingHorizontal: '7%', paddingTop: 140, paddingBottom: 18 },
  emptyText: { color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 40, fontWeight: '800' },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    marginTop: 12,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  subText: { color: 'rgba(255,255,255,0.72)', marginTop: 6, fontWeight: '700', fontSize: 12 },

  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  rowText: { color: 'rgba(255,255,255,0.78)', fontWeight: '800', fontSize: 12 },
  queueText: { color: MUTED2, marginTop: 10, fontSize: 11, fontWeight: '800' },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(92,255,176,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(92,255,176,0.35)',
  },
  statusText: { fontSize: 11, fontWeight: '900', color: '#fff' },

  modalBg: { flex: 1 },

  modalClose: {
    position: 'absolute',
    top: 30,
    right: 16,
    zIndex: 30,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalContent: { flexGrow: 1, paddingHorizontal: '7%', paddingTop: 90, paddingBottom: 30 },

  modalCard: {
    backgroundColor: CARD_BG,
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

  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  modalDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 16 },

  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(255,182,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: MUTED, fontWeight: '800', fontSize: 12 },
  infoValue: { color: '#fff', fontWeight: '900', fontSize: 13, marginTop: 2 },
});
