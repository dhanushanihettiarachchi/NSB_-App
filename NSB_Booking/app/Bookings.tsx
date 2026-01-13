// app/Bookings.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL } from './config';
import { useBookingDraft } from './context/BookingDraftContext';

type Room = {
  room_Id: number;
  room_Name: string;
  room_Count: number;
  max_Persons: number;
  price_per_person: number;
};

type BlockedRange = {
  booking_id: number;
  circuit_id: number;
  check_in_date: string;
  check_out_date: string;
  booking_time?: string | null;
  status: string; // Approved
};

const NAVY = '#020038';
const BLACK_BOX = '#050515';
const CREAM_INPUT = '#FFEBD3';
const YELLOW = '#FFB600';
const BTN_TEXT = '#00113D';
const CARD_EDGE = '#2C2750';
const PANEL = '#0A0830';

// ------- Web datepicker -------
let WebDatePicker: any = null;
if (Platform.OS === 'web') {
  WebDatePicker = require('react-datepicker').default;
  require('react-datepicker/dist/react-datepicker.css');
}

// ---------- helpers ----------
const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDateYYYYMMDD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatTimeHHMM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const parseYYYYMMDD = (s: string) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

const diffNights = (checkInStr: string, checkOutStr: string) => {
  const a = parseYYYYMMDD(checkInStr);
  const b = parseYYYYMMDD(checkOutStr);
  if (!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  const nights = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
};

// web input styles (react-datepicker custom input)
const webInputStyle: any =
  Platform.OS === 'web'
    ? {
        width: '100%',
        height: 44,
        background: CREAM_INPUT,
        border: 'none',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 14,
        fontWeight: 600,
        color: BTN_TEXT,
        outline: 'none',
        boxSizing: 'border-box',
        display: 'block',
      }
    : {};

// ✅ Label with “Required” badge
function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{text}</Text>
      {required ? (
        <View style={styles.requiredPill}>
          <Text style={styles.requiredPillText}>Required</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------- overlap helpers (UI blocking) ----------
// Build a datetime using date string "YYYY-MM-DD" and time "HH:mm" (default 10:00)
const buildDT = (dateStr: string, timeStr?: string | null) => {
  const d = String(dateStr || '').slice(0, 10);
  const t = (String(timeStr || '') || '10:00').slice(0, 5);
  // keep it simple: local time
  return new Date(`${d}T${t}:00`);
};

// ✅ Overlap check: newStart < oldEnd && newEnd > oldStart
const overlapsApproved = (
  newCheckIn: string,
  newCheckOut: string,
  newTime: string | null,
  blocked: BlockedRange[]
) => {
  if (!newCheckIn || !newCheckOut) return false;
  const newStart = buildDT(newCheckIn, newTime || '10:00');
  const newEnd = buildDT(newCheckOut, newTime || '10:00');
  if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) return false;

  return blocked.some((b) => {
    if (String(b.status || '').toLowerCase() !== 'approved') return false;
    const oldStart = buildDT(b.check_in_date, b.booking_time || '10:00');
    const oldEnd = buildDT(b.check_out_date, b.booking_time || '10:00');
    if (Number.isNaN(oldStart.getTime()) || Number.isNaN(oldEnd.getTime())) return false;
    return oldStart < newEnd && oldEnd > newStart;
  });
};

// return true if a single date is inside any approved range (for disabling)
const dateInsideApprovedRange = (dateStr: string, blocked: BlockedRange[]) => {
  const d = parseYYYYMMDD(dateStr);
  if (!d) return false;
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  return blocked.some((b) => {
    if (String(b.status || '').toLowerCase() !== 'approved') return false;
    const oldStart = buildDT(b.check_in_date, b.booking_time || '10:00');
    const oldEnd = buildDT(b.check_out_date, b.booking_time || '10:00');
    return oldStart < dayEnd && oldEnd > dayStart;
  });
};

// ✅ Web (react-datepicker): excludeDates expects Date[]
const buildExcludeDates = (blocked: BlockedRange[]) => {
  // Generate dates for the next 365 days and exclude if inside approved
  const out: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = formatDateYYYYMMDD(d);
    if (dateInsideApprovedRange(ds, blocked)) out.push(d);
  }
  return out;
};

export default function Bookings() {
  const params = useLocalSearchParams();
  const circuitId = String(params.circuitId ?? '');
  const circuitName = String(params.circuitName ?? '');
  const city = String(params.city ?? '');
  const street = String(params.street ?? '');
  const userId = Number(params.userId ?? 0);

  const { setDraft } = useBookingDraft();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  // Dates/time
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [bookingTime, setBookingTime] = useState('');

  // Purpose
  const [purpose, setPurpose] = useState('');

  // Selected room types and qty
  const [selectedRoomQty, setSelectedRoomQty] = useState<Record<number, number>>({});
  const [guestsByRoom, setGuestsByRoom] = useState<Record<number, number>>({});

  // Dropdowns
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);

  // Mobile picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerTarget, setPickerTarget] = useState<'checkIn' | 'checkOut' | 'time'>('checkIn');
  const [tempPickerValue, setTempPickerValue] = useState<Date>(new Date());

  // ✅ Approved blocked ranges for this circuit (from backend)
  const [blocked, setBlocked] = useState<BlockedRange[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  const clearForm = () => {
    setCheckIn('');
    setCheckOut('');
    setBookingTime('');
    setPurpose('');
    setSelectedRoomQty({});
    setGuestsByRoom({});
    setRoomPickerOpen(false);
  };

  // Load rooms
  useEffect(() => {
    const load = async () => {
      if (!circuitId) {
        setLoadingRooms(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/circuits/${circuitId}`);
        const json = await res.json().catch(() => ({}));
        setRooms((json.rooms || []) as Room[]);
      } catch (e) {
        console.log('load rooms error:', e);
      } finally {
        setLoadingRooms(false);
      }
    };
    load();
  }, [circuitId]);

  // ✅ Load approved blocked date ranges for this circuit
  useEffect(() => {
    const loadBlocked = async () => {
      if (!circuitId) return;
      try {
        setLoadingBlocked(true);
        const res = await fetch(`${API_URL}/bookings/unavailable?circuitId=${encodeURIComponent(circuitId)}`);
        const json = await res.json().catch(() => ({}));
        const list = (json.blocked || []) as BlockedRange[];
        setBlocked(Array.isArray(list) ? list : []);
      } catch (e) {
        console.log('load blocked error:', e);
        setBlocked([]);
      } finally {
        setLoadingBlocked(false);
      }
    };
    loadBlocked();
  }, [circuitId]);

  // ---- computed ----
  const nights = useMemo(() => diffNights(checkIn, checkOut), [checkIn, checkOut]);

  const selectedRoomsList = useMemo(() => {
    return rooms
      .map((r) => ({ room: r, qty: selectedRoomQty[r.room_Id] || 0 }))
      .filter((x) => x.qty > 0);
  }, [rooms, selectedRoomQty]);

  const totalRoomsSelected = useMemo(
    () => selectedRoomsList.reduce((sum, x) => sum + x.qty, 0),
    [selectedRoomsList]
  );

  const totalCapacity = useMemo(() => {
    return selectedRoomsList.reduce((sum, x) => sum + x.qty * (x.room.max_Persons || 0), 0);
  }, [selectedRoomsList]);

  const totalGuestsNum = useMemo(() => {
    return selectedRoomsList.reduce((sum, x) => sum + (guestsByRoom[x.room.room_Id] || 0), 0);
  }, [selectedRoomsList, guestsByRoom]);

  const perRoomTotals = useMemo(() => {
    return selectedRoomsList.map((x) => {
      const guestsInThis = guestsByRoom[x.room.room_Id] || 0;
      const subtotal =
        nights && x.room.price_per_person ? guestsInThis * nights * x.room.price_per_person : 0;

      return {
        room_Id: x.room.room_Id,
        room_Name: x.room.room_Name,
        qty: x.qty,
        guests: guestsInThis,
        pricePerPerson: x.room.price_per_person,
        maxPersons: x.room.max_Persons,
        subtotal,
      };
    });
  }, [selectedRoomsList, guestsByRoom, nights]);

  const grandTotal = useMemo(
    () => perRoomTotals.reduce((sum, x) => sum + x.subtotal, 0),
    [perRoomTotals]
  );

  // ✅ Web: compute excluded dates list
  const webExcludeDates = useMemo(() => buildExcludeDates(blocked), [blocked]);

  // ---- actions ----
  const addRoomType = (roomId: number) => {
    const room = rooms.find((r) => r.room_Id === roomId);
    if (!room) return;

    setSelectedRoomQty((prev) => {
      if (prev[roomId] && prev[roomId] > 0) return prev;
      return { ...prev, [roomId]: 1 };
    });

    setGuestsByRoom((prev) => ({ ...prev, [roomId]: prev[roomId] ?? 0 }));
    setRoomPickerOpen(false);
  };

  const incQty = (room: Room) => {
    setSelectedRoomQty((prev) => {
      const current = prev[room.room_Id] || 0;
      const next = Math.min(room.room_Count, current + 1);
      if (next === current) {
        Alert.alert('Limit reached', `Only ${room.room_Count} rooms available for Room ${room.room_Name}.`);
      }
      return { ...prev, [room.room_Id]: next };
    });
  };

  const decQty = (room: Room) => {
    setSelectedRoomQty((prev) => {
      const current = prev[room.room_Id] || 0;
      const next = Math.max(0, current - 1);
      const updated = { ...prev, [room.room_Id]: next };

      if (next === 0) {
        delete updated[room.room_Id];
        setGuestsByRoom((gprev) => {
          const g = { ...gprev };
          delete g[room.room_Id];
          return g;
        });
      } else {
        setGuestsByRoom((gprev) => {
          const cap = next * room.max_Persons;
          const currentGuests = gprev[room.room_Id] || 0;
          if (currentGuests <= cap) return gprev;
          return { ...gprev, [room.room_Id]: cap };
        });
      }

      return updated;
    });
  };

  const setGuestsForRoom = (room: Room, value: string, qty: number) => {
    const n = parseInt(value || '0', 10);
    const safe = Number.isFinite(n) ? n : 0;
    const cap = qty * room.max_Persons;

    if (safe > cap) {
      Alert.alert('Capacity', `Max guests for Room ${room.room_Name} is ${cap} (based on selected rooms).`);
      setGuestsByRoom((prev) => ({ ...prev, [room.room_Id]: cap }));
      return;
    }
    setGuestsByRoom((prev) => ({ ...prev, [room.room_Id]: Math.max(0, safe) }));
  };

  // ---- pickers ----
  const openDatePicker = (target: 'checkIn' | 'checkOut') => {
    setPickerTarget(target);
    setPickerMode('date');

    const base =
      target === 'checkIn'
        ? parseYYYYMMDD(checkIn) ?? new Date()
        : parseYYYYMMDD(checkOut) ?? (parseYYYYMMDD(checkIn) ?? new Date());

    setTempPickerValue(base);
    setPickerOpen(true);
  };

  const openTimePicker = () => {
    setPickerTarget('time');
    setPickerMode('time');
    setTempPickerValue(new Date());
    setPickerOpen(true);
  };

  const applyPickerValue = () => {
    if (pickerTarget === 'time') {
      const nextTime = formatTimeHHMM(tempPickerValue);

      // if user already selected dates, validate overlap immediately
      if (checkIn && checkOut && overlapsApproved(checkIn, checkOut, nextTime, blocked)) {
        Alert.alert(
          'Not available',
          'That time overlaps an approved booking. Please select another date/time.'
        );
        setPickerOpen(false);
        return;
      }

      setBookingTime(nextTime);
      setPickerOpen(false);
      return;
    }

    const picked = formatDateYYYYMMDD(tempPickerValue);

    // ✅ block picking dates that are inside approved ranges (UI)
    if (dateInsideApprovedRange(picked, blocked)) {
      Alert.alert('Not available', 'This date is already booked (approved). Please select another date.');
      setPickerOpen(false);
      return;
    }

    if (pickerTarget === 'checkIn') {
      setCheckIn(picked);
      if (!checkOut || checkOut <= picked) {
        const next = new Date(tempPickerValue);
        next.setDate(next.getDate() + 1);
        const nextStr = formatDateYYYYMMDD(next);

        // If auto next day is blocked, still set but warn user
        if (dateInsideApprovedRange(nextStr, blocked)) {
          setCheckOut(nextStr);
          Alert.alert(
            'Warning',
            'Your automatic check-out day is already booked. Please change check-out date.'
          );
        } else {
          setCheckOut(nextStr);
        }
      }
      setPickerOpen(false);
      return;
    }

    if (pickerTarget === 'checkOut') {
      // must be after check-in
      if (checkIn && picked <= checkIn) {
        Alert.alert('Invalid', 'Check-out must be after check-in.');
        setPickerOpen(false);
        return;
      }

      // Validate full range overlap when setting checkout
      const time = bookingTime || '10:00';
      if (checkIn && overlapsApproved(checkIn, picked, time, blocked)) {
        Alert.alert(
          'Not available',
          'This stay overlaps an approved booking. Please change dates.'
        );
        setPickerOpen(false);
        return;
      }

      setCheckOut(picked);
      setPickerOpen(false);
      return;
    }

    setPickerOpen(false);
  };

  // ---- validation ----
  const validate = () => {
    if (selectedRoomsList.length === 0) return 'Please add at least one room type.';
    if (!checkIn) return 'Please select check-in date.';
    if (!checkOut) return 'Please select check-out date.';
    if (checkOut <= checkIn) return 'Check-out date must be after check-in date.';
    if (!nights) return 'Please select valid dates (at least 1 night).';

    // ✅ ensure range does not overlap approved bookings (UI level)
    const time = bookingTime || '10:00';
    if (overlapsApproved(checkIn, checkOut, time, blocked)) {
      return 'Selected date/time overlaps an approved booking. Please select another date.';
    }

    if (totalGuestsNum <= 0) return 'Please enter guests for at least one selected room type.';
    if (totalGuestsNum > totalCapacity) {
      return `Not enough capacity. Selected rooms can host ${totalCapacity}, but you entered ${totalGuestsNum} guests.`;
    }
    if (!grandTotal || grandTotal <= 0) return 'Total amount is 0. Please check guests and dates.';
    return null;
  };

  /**
   * ✅ ACTION 1: Submit booking now (Pending) and pay later
   */
  const submitBookingPayLater = async () => {
    const err = validate();
    if (err) return Alert.alert('Validation', err);

    if (!userId) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    const payload = {
      circuit_id: Number(circuitId),
      booking_date: formatDateYYYYMMDD(new Date()),
      check_in_date: checkIn,
      check_out_date: checkOut,
      booking_time: bookingTime || null,
      purpose: purpose || null,
      items: selectedRoomsList.map(({ room, qty }) => ({
        room_id: room.room_Id,
        need_room_count: qty,
        guest_count: guestsByRoom[room.room_Id] || 0,
      })),
    };

    try {
      const res = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        Alert.alert('Booking Failed', data?.message || 'Server error');
        return;
      }

      clearForm();

      Alert.alert(
        'Booking Submitted ✅',
        'Your booking request is saved as Pending.\nYou can upload payment slip later from your bookings list.'
      );
    } catch (err) {
      console.error('Submit booking error:', err);
      Alert.alert('Error', 'Unable to submit booking');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * ✅ ACTION 2: Continue to Payment
   * Creates booking first, then navigates to UploadSlip with bookingId + amount
   */
  const continueToPaymentNow = async () => {
    console.log('ContinueToPayment clicked', { userId, circuitId, checkIn, checkOut, nights, grandTotal });

    const err = validate();
    if (err) return Alert.alert('Validation', err);

    if (!userId) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    const payload = {
      circuit_id: Number(circuitId),
      booking_date: formatDateYYYYMMDD(new Date()),
      check_in_date: checkIn,
      check_out_date: checkOut,
      booking_time: bookingTime || null,
      purpose: purpose || null,
      items: selectedRoomsList.map(({ room, qty }) => ({
        room_id: room.room_Id,
        need_room_count: qty,
        guest_count: guestsByRoom[room.room_Id] || 0,
      })),
    };

    try {
      const res = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      console.log('POST /bookings response', { ok: res.ok, status: res.status, data });

      if (!res.ok) {
        Alert.alert('Booking Failed', data?.message || 'Server error');
        return;
      }

      // ✅ get booking ids from backend
      const booking_ids: number[] = Array.isArray(data?.booking_ids) ? data.booking_ids : [];
      const bookingId = booking_ids[0] ? Number(booking_ids[0]) : 0;

      if (!bookingId) {
        Alert.alert(
          'Backend error',
          'Booking created but booking_ids not returned.\nFix backend POST /bookings to return { booking_ids: [...] }'
        );
        return;
      }

      // ✅ store draft (UploadSlip reads it)
      const draftItems = selectedRoomsList.map(({ room, qty }) => ({
        room_id: room.room_Id,
        room_name: room.room_Name,
        need_room_count: qty,
        guest_count: guestsByRoom[room.room_Id] || 0,
        max_persons: room.max_Persons,
        price_per_person: room.price_per_person,
      }));

      setDraft({
        userId,
        circuitId,
        circuitName,
        city,
        street,
        check_in_date: checkIn,
        check_out_date: checkOut,
        booking_time: bookingTime || null,
        purpose: purpose || null,
        nights,
        items: draftItems,
        totalGuests: totalGuestsNum,
        totalRooms: totalRoomsSelected,
        totalCapacity,
        grandTotal,
        booking_ids,
        paymentProofUploaded: false,
      });

      // ✅ go to upload slip now
      router.push({
        pathname: '/UploadSlip',
        params: {
          userId: String(userId),
          bookingId: String(bookingId),
          amount: String(grandTotal),
        },
      });

      clearForm();
    } catch (e) {
      console.log('ContinueToPayment error:', e);
      Alert.alert('Error', 'Unable to continue to payment');
    } finally {
      setSubmitting(false);
    }
  };

  // web date helpers
  const webSelected = (s: string) => parseYYYYMMDD(s);
  const webSetDate =
    (setter: (v: string) => void) =>
    (d: Date | null) =>
      setter(d ? formatDateYYYYMMDD(d) : '');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.topCard}>
        <Text style={styles.circuitTitle}>{circuitName || 'Circuit'}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color={CREAM_INPUT} />
          <Text style={styles.locationText}>
            {city}
            {street ? ` · ${street}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Booking Details</Text>

        {/* ✅ show blocked loading */}
        {(loadingBlocked && (
          <View style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Loading availability...</Text>
          </View>
        )) || null}

        {/* Room dropdown */}
        <Label text="Room Types" required />
        {loadingRooms ? (
          <ActivityIndicator color="#fff" />
        ) : rooms.length === 0 ? (
          <Text style={styles.hint}>No rooms available.</Text>
        ) : (
          <>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setRoomPickerOpen((v) => !v)}
              activeOpacity={0.9}
            >
              <Text style={styles.dropdownText}>
                {selectedRoomsList.length === 0 ? 'Select room type(s)' : 'Add another room type'}
              </Text>
              <Ionicons
                name={roomPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={BTN_TEXT}
              />
            </TouchableOpacity>

            {roomPickerOpen && (
              <View style={styles.dropdownPanel}>
                {rooms
                  .filter((r) => !selectedRoomQty[r.room_Id])
                  .map((r) => (
                    <TouchableOpacity
                      key={r.room_Id}
                      style={styles.dropdownItem}
                      onPress={() => addRoomType(r.room_Id)}
                    >
                      <Text style={styles.dropdownItemTitle}>Room {r.room_Name}</Text>
                      <Text style={styles.dropdownItemSub}>
                        Available {r.room_Count} • Max/room {r.max_Persons} • Rs {r.price_per_person}/person
                      </Text>
                    </TouchableOpacity>
                  ))}

                {rooms.filter((r) => !selectedRoomQty[r.room_Id]).length === 0 && (
                  <Text style={styles.hint}>All room types are already added.</Text>
                )}
              </View>
            )}

            {selectedRoomsList.length > 0 && (
              <View style={{ marginTop: 12, gap: 10 }}>
                {selectedRoomsList.map(({ room, qty }) => {
                  const cap = qty * room.max_Persons;
                  return (
                    <View key={room.room_Id} style={styles.selectedRoomRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectedRoomTitle}>Room {room.room_Name}</Text>
                        <Text style={styles.selectedRoomSub}>
                          Available {room.room_Count} • Max/room {room.max_Persons} • Rs {room.price_per_person}/person
                        </Text>
                      </View>

                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={[styles.stepBtnCream, qty === 0 && { opacity: 0.6 }]}
                          onPress={() => decQty(room)}
                          disabled={qty === 0}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="remove" size={18} color={BTN_TEXT} />
                        </TouchableOpacity>

                        <View style={styles.stepCount}>
                          <Text style={styles.stepCountText}>{qty}</Text>
                        </View>

                        <TouchableOpacity style={styles.stepBtnCream} onPress={() => incQty(room)} activeOpacity={0.85}>
                          <Ionicons name="add" size={18} color={BTN_TEXT} />
                        </TouchableOpacity>
                      </View>

                      <View style={{ marginTop: 10, width: '100%' }}>
                        <Label text={`Guests in ${room.room_Name}`} required />
                        <Text style={styles.smallHint}>Max {cap} (based on selected rooms)</Text>

                        <TextInput
                          style={styles.input}
                          keyboardType="number-pad"
                          value={String(guestsByRoom[room.room_Id] ?? 0)}
                          onChangeText={(v) => setGuestsForRoom(room, v, qty)}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Dates */}
        <Label text="Check-in Date" required />
        {Platform.OS === 'web' ? (
          WebDatePicker ? (
            <WebDatePicker
              selected={webSelected(checkIn)}
              onChange={(d: Date | null) => {
                const picked = d ? formatDateYYYYMMDD(d) : '';

                if (picked && dateInsideApprovedRange(picked, blocked)) {
                  Alert.alert('Not available', 'This date is already booked (approved). Please select another date.');
                  return;
                }

                setCheckIn(picked);

                if (d) {
                  const next = new Date(d);
                  next.setDate(next.getDate() + 1);
                  const nextStr = formatDateYYYYMMDD(next);
                  if (!checkOut || checkOut <= picked) setCheckOut(nextStr);
                }
              }}
              minDate={new Date()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select a date"
              excludeDates={webExcludeDates}
              customInput={<input style={webInputStyle} />}
            />
          ) : (
            <Text style={styles.hint}>Install react-datepicker to show calendar on web.</Text>
          )
        ) : (
          <TouchableOpacity style={styles.pickerInput} onPress={() => openDatePicker('checkIn')}>
            <Text style={[styles.pickerText, !checkIn && styles.placeholder]}>{checkIn || 'Select a date'}</Text>
            <Ionicons name="calendar-outline" size={18} color="#2a2250" />
          </TouchableOpacity>
        )}

        <Label text="Check-out Date" required />
        {Platform.OS === 'web' ? (
          WebDatePicker ? (
            <WebDatePicker
              selected={webSelected(checkOut)}
              onChange={(d: Date | null) => {
                const picked = d ? formatDateYYYYMMDD(d) : '';

                if (picked && dateInsideApprovedRange(picked, blocked)) {
                  Alert.alert('Not available', 'This date is already booked (approved). Please select another date.');
                  return;
                }

                // full range overlap check
                const time = bookingTime || '10:00';
                if (checkIn && picked && overlapsApproved(checkIn, picked, time, blocked)) {
                  Alert.alert('Not available', 'This stay overlaps an approved booking. Please change dates.');
                  return;
                }

                setCheckOut(picked);
              }}
              minDate={
                checkIn
                  ? (() => {
                      const d = parseYYYYMMDD(checkIn) || new Date();
                      d.setDate(d.getDate() + 1);
                      return d;
                    })()
                  : new Date()
              }
              dateFormat="yyyy-MM-dd"
              placeholderText="Select a date"
              excludeDates={webExcludeDates}
              customInput={<input style={webInputStyle} />}
            />
          ) : (
            <Text style={styles.hint}>Install react-datepicker to show calendar on web.</Text>
          )
        ) : (
          <TouchableOpacity style={styles.pickerInput} onPress={() => openDatePicker('checkOut')}>
            <Text style={[styles.pickerText, !checkOut && styles.placeholder]}>{checkOut || 'Select a date'}</Text>
            <Ionicons name="calendar-outline" size={18} color="#2a2250" />
          </TouchableOpacity>
        )}

        {/* Time */}
        <Label text="Check-in Time" />
        {Platform.OS === 'web' ? (
          WebDatePicker ? (
            <WebDatePicker
              selected={
                bookingTime
                  ? (() => {
                      const [hh, mm] = bookingTime.split(':').map(Number);
                      const d = new Date();
                      d.setHours(hh || 0);
                      d.setMinutes(mm || 0);
                      return d;
                    })()
                  : null
              }
              onChange={(d: Date | null) => {
                const nextTime = d ? formatTimeHHMM(d) : '';

                // If dates selected, block time selection if overlap
                const time = nextTime || '10:00';
                if (checkIn && checkOut && overlapsApproved(checkIn, checkOut, time, blocked)) {
                  Alert.alert('Not available', 'That time overlaps an approved booking. Please choose another.');
                  return;
                }

                setBookingTime(nextTime);
              }}
              showTimeSelect
              showTimeSelectOnly
              timeIntervals={15}
              timeCaption="Time"
              dateFormat="HH:mm"
              placeholderText="Select time"
              customInput={<input style={webInputStyle} />}
            />
          ) : (
            <Text style={styles.hint}>Install react-datepicker to show time picker on web.</Text>
          )
        ) : (
          <TouchableOpacity style={styles.pickerInput} onPress={openTimePicker}>
            <Text style={[styles.pickerText, !bookingTime && styles.placeholder]}>{bookingTime || 'Select time'}</Text>
            <Ionicons name="time-outline" size={18} color="#2a2250" />
          </TouchableOpacity>
        )}

        {/* Purpose */}
        <Label text="Purpose of Stay" />
        <TextInput
          value={purpose}
          onChangeText={setPurpose}
          placeholder="e.g., Business meeting, Training..."
          placeholderTextColor="#8b7d70"
          style={[styles.input, styles.textArea]}
          multiline
        />

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Booking Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Nights</Text>
            <Text style={styles.summaryValue}>{nights || '-'}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Guests</Text>
            <Text style={styles.summaryValue}>{totalGuestsNum || '-'}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Rooms Selected</Text>
            <Text style={styles.summaryValue}>{totalRoomsSelected || '-'}</Text>
          </View>

          <View style={styles.summaryDivider} />

          {perRoomTotals.length === 0 ? (
            <Text style={styles.hint}>Select rooms to see summary.</Text>
          ) : (
            perRoomTotals.map((x) => (
              <View key={x.room_Id} style={styles.roomSummaryCard}>
                <Text style={styles.roomSummaryTitle}>Room {x.room_Name}</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Rooms</Text>
                  <Text style={styles.summaryValue}>{x.qty}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Guests</Text>
                  <Text style={styles.summaryValue}>{x.guests}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Price / person</Text>
                  <Text style={styles.summaryValue}>Rs {x.pricePerPerson}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>Rs {x.subtotal}</Text>
                </View>
              </View>
            ))
          )}

          <View style={styles.summaryDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalValue}>{grandTotal ? `Rs ${grandTotal}` : '-'}</Text>
          </View>

          <Text style={styles.summaryNote}>
            Total = nights × (guests in each room type) × price/person
          </Text>

          <Text style={styles.paymentHint}>
            You can submit booking now and upload payment proof later, or continue to payment now.
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
          onPress={submitBookingPayLater}
          disabled={submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <>
              <ActivityIndicator color={BTN_TEXT} />
              <Text style={styles.primaryBtnText}>Submitting...</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={BTN_TEXT} />
              <Text style={styles.primaryBtnText}>Submit Booking (Pay Later)</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, submitting && { opacity: 0.7 }]}
          onPress={continueToPaymentNow}
          disabled={submitting}
          activeOpacity={0.9}
        >
          <Ionicons name="card-outline" size={18} color={CREAM_INPUT} />
          <Text style={styles.secondaryBtnText}>Continue to Payment</Text>
        </TouchableOpacity>

        <Text style={styles.footerHint}>Booking status will be Pending until admin approval.</Text>
      </View>

      {/* overlay */}
      <Modal visible={submitting} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.submittingCard}>
            <ActivityIndicator color={YELLOW} />
            <Text style={styles.submittingTitle}>Processing...</Text>
            <Text style={styles.submittingSub}>Please wait. Do not refresh or go back.</Text>
          </View>
        </View>
      </Modal>

      {/* Mobile Modal Picker */}
      {Platform.OS !== 'web' && (
        <Modal visible={pickerOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {pickerMode === 'date'
                  ? pickerTarget === 'checkIn'
                    ? 'Select Check-in Date'
                    : 'Select Check-out Date'
                  : 'Select Check-in Time'}
              </Text>

              <DateTimePicker
                value={tempPickerValue}
                mode={pickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  if (date) setTempPickerValue(date);
                }}
                minimumDate={
                  pickerMode === 'date'
                    ? pickerTarget === 'checkOut' && checkIn
                      ? (() => {
                          const d = parseYYYYMMDD(checkIn) ?? new Date();
                          d.setDate(d.getDate() + 1);
                          return d;
                        })()
                      : new Date()
                    : undefined
                }
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setPickerOpen(false)}>
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalBtn} onPress={applyPickerValue}>
                  <Text style={styles.modalBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: '6%',
    backgroundColor: NAVY,
    flexGrow: 1,
  },
  headerBack: { position: 'absolute', top: 20, left: 16, zIndex: 10, padding: 4 },

  topCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: CARD_EDGE,
  },
  circuitTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  locationRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  locationText: { color: '#E2DCD2', fontSize: 13, fontWeight: '500' },

  formCard: { backgroundColor: BLACK_BOX, borderRadius: 18, padding: 16, marginTop: 16 },
  formTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 10 },

  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 6 },
  label: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  requiredPill: { backgroundColor: '#2C2750', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  requiredPillText: { color: CREAM_INPUT, fontSize: 11, fontWeight: '600' },

  smallHint: { color: '#B8B0A5', fontSize: 12, marginTop: 4, fontStyle: 'italic' },

  input: { backgroundColor: CREAM_INPUT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: BTN_TEXT, fontWeight: '600' },
  textArea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },

  pickerInput: { backgroundColor: CREAM_INPUT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { color: BTN_TEXT, fontWeight: '600' },
  placeholder: { color: '#8b7d70', fontWeight: '500' },

  hint: { color: '#B8B0A5', fontSize: 12, marginTop: 6, fontStyle: 'italic' },

  dropdown: { backgroundColor: CREAM_INPUT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownText: { color: BTN_TEXT, fontWeight: '600' },
  dropdownPanel: { marginTop: 10, backgroundColor: PANEL, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: CARD_EDGE, gap: 8 },
  dropdownItem: { backgroundColor: BLACK_BOX, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: CARD_EDGE },
  dropdownItemTitle: { color: '#FFFFFF', fontWeight: '700', marginBottom: 4 },
  dropdownItemSub: { color: '#E2DCD2', fontSize: 12, fontWeight: '500' },

  selectedRoomRow: { backgroundColor: PANEL, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: CARD_EDGE },
  selectedRoomTitle: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  selectedRoomSub: { color: '#E2DCD2', fontSize: 12, fontWeight: '500', marginTop: 4 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  stepBtnCream: { backgroundColor: CREAM_INPUT, width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepCount: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: CARD_EDGE, alignItems: 'center', justifyContent: 'center' },
  stepCountText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  summaryCard: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: CARD_EDGE, backgroundColor: PANEL },
  summaryTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  summaryLabel: { color: '#B8B0A5', fontSize: 13, fontWeight: '500' },
  summaryValue: { color: '#EDE7DC', fontSize: 13, fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: CARD_EDGE, marginVertical: 10 },
  roomSummaryCard: { backgroundColor: BLACK_BOX, borderRadius: 12, padding: 10, marginTop: 10, borderWidth: 1, borderColor: CARD_EDGE },
  roomSummaryTitle: { color: CREAM_INPUT, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  totalLabel: { color: CREAM_INPUT, fontSize: 14, fontWeight: '600' },
  totalValue: { color: YELLOW, fontSize: 16, fontWeight: '700' },
  summaryNote: { marginTop: 10, color: '#B8B0A5', fontSize: 11, fontStyle: 'italic', lineHeight: 14 },
  paymentHint: { marginTop: 10, color: '#E2DCD2', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  primaryBtn: { marginTop: 16, backgroundColor: YELLOW, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryBtnText: { color: BTN_TEXT, fontSize: 14, fontWeight: '700' },

  secondaryBtn: { marginTop: 10, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: CARD_EDGE, backgroundColor: 'transparent' },
  secondaryBtnText: { color: CREAM_INPUT, fontSize: 14, fontWeight: '700' },

  footerHint: { marginTop: 10, textAlign: 'center', color: '#B8B0A5', fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 18 },
  submittingCard: { backgroundColor: BLACK_BOX, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: CARD_EDGE, alignItems: 'center', gap: 10 },
  submittingTitle: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  submittingSub: { color: '#B8B0A5', fontSize: 12, textAlign: 'center' },

  modalCard: { backgroundColor: BLACK_BOX, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: CARD_EDGE },
  modalTitle: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, textAlign: 'center', marginBottom: 10 },
  modalBtns: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { backgroundColor: YELLOW, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  modalBtnText: { color: BTN_TEXT, fontWeight: '700' },
  modalBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: CARD_EDGE },
  modalBtnGhostText: { color: CREAM_INPUT, fontWeight: '600' },
});
