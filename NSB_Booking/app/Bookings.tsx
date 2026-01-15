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
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
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
  check_in_date: string;  // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  booking_time?: string | null; // "HH:mm" or null
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

// ✅ Convert SQL booking_time to "HH:mm" safely (supports string / Date)
const normalizeBookingTimeHHMM = (t: any, fallback: string = '10:00') => {
  if (!t) return fallback;

  // Case 1: "08:15" or "08:15:00.0000000"
  if (typeof t === 'string') {
    const m = t.match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : fallback;
  }

  // Case 2: JS Date object (some drivers serialize SQL time as Date)
  if (t instanceof Date && !Number.isNaN(t.getTime())) {
    return `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
  }

  return fallback;
};


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

// build datetime using date "YYYY-MM-DD" and time "HH:mm" (default 10:00)
const buildDT = (dateStr: string, timeStr?: string | null) => {
  const d = String(dateStr || '').slice(0, 10);
  const t = (String(timeStr || '') || '10:00').slice(0, 5);
  return new Date(`${d}T${t}:00`);
};

// ✅ Overlap check: [oldStart, oldEnd) with rule newStart < oldEnd && newEnd > oldStart
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
    const oldStart = buildDT(b.check_in_date, normalizeBookingTimeHHMM(b.booking_time, '10:00'));
    const oldEnd = buildDT(b.check_out_date, normalizeBookingTimeHHMM(b.booking_time, '10:00'));


    // ✅ [start, end) style overlap
    return oldStart < newEnd && oldEnd > newStart;
  });
};

// ✅ web input style
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

// ✅ Label
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

// ------- date utils for blocking days -------
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// build date string list [start, end) day by day (end excluded)
const daysBetweenExclusiveEnd = (startStr: string, endStr: string) => {
  const start = parseYYYYMMDD(startStr);
  const end = parseYYYYMMDD(endStr);
  if (!start || !end) return [];
  const out: string[] = [];

  // normalize to midnight
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);

  while (cur < endMid) {
    out.push(formatDateYYYYMMDD(cur));
    cur = addDays(cur, 1);
  }
  return out;
};

// checkout-day min time map: date -> latest checkout time on that date
const buildCheckoutMinTimeMap = (blocked: BlockedRange[]) => {
  const map: Record<string, string> = {};
  blocked.forEach((b) => {
    if (String(b.status || '').toLowerCase() !== 'approved') return;
    const day = String(b.check_out_date || '').slice(0, 10);
    const t = normalizeBookingTimeHHMM(b.booking_time, '10:00');



    // keep LATEST
    if (!map[day] || t > map[day]) map[day] = t;
  });
  return map;
};

// blocked days set = all days from check_in to day before check_out
const buildBlockedDaysSet = (blocked: BlockedRange[]) => {
  const s = new Set<string>();
  blocked.forEach((b) => {
    if (String(b.status || '').toLowerCase() !== 'approved') return;
    const days = daysBetweenExclusiveEnd(String(b.check_in_date).slice(0, 10), String(b.check_out_date).slice(0, 10));
    days.forEach((d) => s.add(d));
  });
  return s;
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

  // Dropdown
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);

  // Picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerTarget, setPickerTarget] = useState<'checkIn' | 'checkOut' | 'time'>('checkIn');
  const [tempPickerValue, setTempPickerValue] = useState<Date>(new Date());

  // ✅ blocked ranges approved
  const [blocked, setBlocked] = useState<BlockedRange[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // ✅ UI banner + center popup
  const [uiError, setUiError] = useState('');
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');

  const showUiError = (msg: string) => {
    setUiError(msg);
    setPopupMessage(msg);
    setPopupVisible(true);
    setTimeout(() => setPopupVisible(false), 2600);
    setTimeout(() => setUiError(''), 6000);
  };

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

  // ✅ Load blocked approved ranges (from backend)
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

  const blockedDaysSet = useMemo(() => buildBlockedDaysSet(blocked), [blocked]);
  const checkoutMinTimeMap = useMemo(() => buildCheckoutMinTimeMap(blocked), [blocked]);

  // ✅ for selected check-in day, if it is a checkout day, enforce min time
  const minTimeForSelectedCheckIn = useMemo(() => {
    if (!checkIn) return null;
    return checkoutMinTimeMap[checkIn] || null; // "08:00"
  }, [checkIn, checkoutMinTimeMap]);

  // computed
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

  // ✅ Web: disable days
  const isWebDayDisabled = (date: Date) => {
    const ds = formatDateYYYYMMDD(date);
    return blockedDaysSet.has(ds);
  };

  // ✅ Web: make list of excluded dates (next 365)
  const webExcludeDates = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = addDays(today, i);
      if (isWebDayDisabled(d)) out.push(d);
    }
    return out;
  }, [blockedDaysSet]);

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
      if (next === current) showUiError(`Only ${room.room_Count} rooms available for Room ${room.room_Name}.`);
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
      showUiError(`Max guests for Room ${room.room_Name} is ${cap} (based on selected rooms).`);
      setGuestsByRoom((prev) => ({ ...prev, [room.room_Id]: cap }));
      return;
    }
    setGuestsByRoom((prev) => ({ ...prev, [room.room_Id]: Math.max(0, safe) }));
  };

  // ---- pickers ----
  const openDatePicker = (target: 'checkIn' | 'checkOut') => {
    setPickerTarget(target);
    setPickerMode('date');
    setPickerOpen(true);
  };

  const openTimePicker = () => {
    setPickerTarget('time');
    setPickerMode('time');
    setTempPickerValue(new Date());
    setPickerOpen(true);
  };

  // ✅ validate checkout-day min time
  const validateMinTimeRule = (dateStr: string, timeStr: string) => {
    const minT = checkoutMinTimeMap[dateStr];
    if (minT && timeStr && timeStr < minT) {
      showUiError(`After ${minT} you can check in.`);
      return false;
    }
    return true;
  };

  const applyTimePicker = () => {
    const nextTime = formatTimeHHMM(tempPickerValue);

    // ✅ if check-in is a checkout-day, enforce min time
    if (checkIn) {
      if (!validateMinTimeRule(checkIn, nextTime)) {
        setPickerOpen(false);
        return;
      }
    }

    // ✅ also validate overlap if dates are set
    const time = nextTime || '10:00';
    if (checkIn && checkOut && overlapsApproved(checkIn, checkOut, time, blocked)) {
      showUiError('Selected date/time overlaps an approved booking. Please select another date/time.');
      setPickerOpen(false);
      return;
    }

    setBookingTime(nextTime);
    setPickerOpen(false);
  };

  // ---- validation ----
  const validate = () => {
    if (!checkIn) return 'Please select check-in date.';
    if (!checkOut) return 'Please select check-out date.';
    if (checkOut <= checkIn) return 'Check-out date must be after check-in date.';
    if (!nights) return 'Please select valid dates (at least 1 night).';

    // ✅ enforce min time rule if applicable
    const time = bookingTime || '10:00';
    if (!validateMinTimeRule(checkIn, time)) return 'Please select a valid time.';

    // ✅ ensure range does not overlap approved bookings
    if (overlapsApproved(checkIn, checkOut, time, blocked)) {
      return 'Selected date/time overlaps an approved booking. Please select another date/time.';
    }

    if (selectedRoomsList.length === 0) return 'Please add at least one room type.';
    if (totalGuestsNum <= 0) return 'Please enter guests for at least one selected room type.';
    if (totalGuestsNum > totalCapacity) {
      return `Not enough capacity. Selected rooms can host ${totalCapacity}, but you entered ${totalGuestsNum} guests.`;
    }
    if (!grandTotal || grandTotal <= 0) return 'Total amount is 0. Please check guests and dates.';
    return null;
  };

  /**
   * Submit booking (Pay later)
   */
  const submitBookingPayLater = async () => {
    const err = validate();
    if (err) return showUiError(err);

    if (!userId) return showUiError('User not logged in');
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
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showUiError(data?.message || 'Booking Failed');
        return;
      }

      clearForm();
      showUiError('Booking submitted ✅ (Pending). You can upload payment slip later.');
    } catch (e) {
      console.log(e);
      showUiError('Unable to submit booking');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Continue to payment
   */
  const continueToPaymentNow = async () => {
    const err = validate();
    if (err) return showUiError(err);

    if (!userId) return showUiError('User not logged in');
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
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showUiError(data?.message || 'Booking Failed');
        return;
      }

      const booking_ids: number[] = Array.isArray(data?.booking_ids) ? data.booking_ids : [];
      const bookingId = booking_ids[0] ? Number(booking_ids[0]) : 0;
      if (!bookingId) return showUiError('Booking created but booking_ids not returned.');

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

      router.push({
        pathname: '/UploadSlip',
        params: { userId: String(userId), bookingId: String(bookingId), amount: String(grandTotal) },
      });

      clearForm();
    } catch (e) {
      console.log(e);
      showUiError('Unable to continue to payment');
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ build marked dates for mobile calendar
  const markedDatesForMobile = useMemo(() => {
    const marked: any = {};

    // mark blocked days (red + disabled)
    blockedDaysSet.forEach((d) => {
      marked[d] = {
        disabled: true,
        disableTouchEvent: true,
        customStyles: {
          container: { backgroundColor: '#B00020', borderRadius: 8, opacity: 0.35 },
          text: { color: '#fff', fontWeight: '700' },
        },
      };
    });

    // mark checkout-days (yellow border) - selectable
    Object.keys(checkoutMinTimeMap).forEach((d) => {
      if (!marked[d]) marked[d] = {};
      marked[d] = {
        ...marked[d],
        customStyles: {
          ...(marked[d]?.customStyles || {}),
          container: {
            ...(marked[d]?.customStyles?.container || {}),
            borderWidth: 2,
            borderColor: '#FFB600',
          },
        },
      };
    });

    // selected checkIn/checkOut highlight
    if (checkIn) {
      marked[checkIn] = {
        ...(marked[checkIn] || {}),
        selected: true,
        selectedColor: '#FFB600',
        customStyles: {
          ...(marked[checkIn]?.customStyles || {}),
          container: { backgroundColor: '#FFB600', borderRadius: 8 },
          text: { color: '#00113D', fontWeight: '900' },
        },
      };
    }
    if (checkOut) {
      marked[checkOut] = {
        ...(marked[checkOut] || {}),
        selected: true,
        selectedColor: '#2C2750',
        customStyles: {
          ...(marked[checkOut]?.customStyles || {}),
          container: { backgroundColor: '#2C2750', borderRadius: 8 },
          text: { color: '#fff', fontWeight: '900' },
        },
      };
    }

    return marked;
  }, [blockedDaysSet, checkoutMinTimeMap, checkIn, checkOut]);

  // web helpers
  const webSelected = (s: string) => parseYYYYMMDD(s);

  // web set date handlers with disable rule
  const setCheckInWeb = (d: Date | null) => {
    if (!d) return setCheckIn('');
    const picked = formatDateYYYYMMDD(d);
    if (blockedDaysSet.has(picked)) {
      showUiError('This date is already booked (Approved). Please select another date.');
      return;
    }
    setCheckIn(picked);

    // auto checkOut next day
    if (!checkOut || checkOut <= picked) {
      const next = addDays(d, 1);
      const nextStr = formatDateYYYYMMDD(next);
      setCheckOut(nextStr);
    }

    // reset rooms selection when changing dates
    setSelectedRoomQty({});
    setGuestsByRoom({});
  };

  const setCheckOutWeb = (d: Date | null) => {
    if (!d) return setCheckOut('');
    const picked = formatDateYYYYMMDD(d);
    if (checkIn && picked <= checkIn) {
      showUiError('Check-out must be after check-in.');
      return;
    }
    if (blockedDaysSet.has(picked)) {
      // NOTE: checkout day itself might be in blockedDaysSet only if some other booking blocks it
      showUiError('This date is already booked (Approved). Please select another date.');
      return;
    }

    // full overlap check
    const time = bookingTime || '10:00';
    if (checkIn && overlapsApproved(checkIn, picked, time, blocked)) {
      showUiError('This stay overlaps an approved booking. Please change dates/time.');
      return;
    }

    setCheckOut(picked);

    setSelectedRoomQty({});
    setGuestsByRoom({});
  };

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

        {(loadingBlocked && (
          <View style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Loading availability...</Text>
          </View>
        )) || null}

        {/* Error banner */}
        {uiError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#fff" />
            <Text style={styles.errorBannerText}>{uiError}</Text>
          </View>
        ) : null}

        {/* ✅ ORDER: Dates -> Time -> Rooms */}

        {/* Check-in Date */}
        <Label text="Check-in Date" required />
        {Platform.OS === 'web' ? (
          WebDatePicker ? (
            <WebDatePicker
              selected={webSelected(checkIn)}
              onChange={setCheckInWeb}
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

        {/* Check-out Date */}
        <Label text="Check-out Date" required />
        {Platform.OS === 'web' ? (
          WebDatePicker ? (
            <WebDatePicker
              selected={webSelected(checkOut)}
              onChange={setCheckOutWeb}
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
                if (checkIn && !validateMinTimeRule(checkIn, nextTime || '10:00')) return;

                const time = nextTime || '10:00';
                if (checkIn && checkOut && overlapsApproved(checkIn, checkOut, time, blocked)) {
                  showUiError('Selected date/time overlaps an approved booking. Please select another.');
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
              <Ionicons name={roomPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={BTN_TEXT} />
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
                        Total {r.room_Count} • Max/room {r.max_Persons} • Rs {r.price_per_person}/person
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
                          Total {room.room_Count} • Max/room {room.max_Persons} • Rs {room.price_per_person}/person
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

          {perRoomTotals.map((x) => (
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
          ))}

          <View style={styles.summaryDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalValue}>{grandTotal ? `Rs ${grandTotal}` : '-'}</Text>
          </View>

          <Text style={styles.summaryNote}>Total = nights × (guests in each room type) × price/person</Text>
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

        {!!minTimeForSelectedCheckIn && (
          <Text style={styles.smallHint}>
            Note: On {checkIn}, check-in allowed only after {minTimeForSelectedCheckIn}.
          </Text>
        )}
      </View>

      {/* ✅ Center popup */}
      <Modal visible={popupVisible} transparent animationType="fade" onRequestClose={() => setPopupVisible(false)}>
        <View style={styles.popupOverlay}>
          <View style={styles.popupCard}>
            <Ionicons name="alert-circle" size={22} color="#fff" />
            <Text style={styles.popupText}>{popupMessage}</Text>
            <TouchableOpacity style={styles.popupBtn} onPress={() => setPopupVisible(false)} activeOpacity={0.85}>
              <Text style={styles.popupBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Submitting overlay */}
      <Modal visible={submitting} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.submittingCard}>
            <ActivityIndicator color={YELLOW} />
            <Text style={styles.submittingTitle}>Processing...</Text>
            <Text style={styles.submittingSub}>Please wait. Do not refresh or go back.</Text>
          </View>
        </View>
      </Modal>

      {/* ✅ Picker modal (Mobile uses Calendar for dates; DateTimePicker for time) */}
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

              {pickerMode === 'date' ? (
                <Calendar
                  markingType="custom"
                  markedDates={markedDatesForMobile}
                  minDate={formatDateYYYYMMDD(new Date())}
                  onDayPress={(day) => {
                    const picked = String(day.dateString || '').slice(0, 10);
                    if (!picked) return;

                    // blocked
                    if (blockedDaysSet.has(picked)) {
                      showUiError('This date is already booked (Approved). Please select another date.');
                      return;
                    }

                    if (pickerTarget === 'checkIn') {
                      setCheckIn(picked);

                      // auto checkout next day
                      if (!checkOut || checkOut <= picked) {
                        const d = parseYYYYMMDD(picked) || new Date();
                        const next = addDays(d, 1);
                        setCheckOut(formatDateYYYYMMDD(next));
                      }

                      // reset room selection on date change
                      setSelectedRoomQty({});
                      setGuestsByRoom({});
                      setPickerOpen(false);
                      return;
                    }

                    if (pickerTarget === 'checkOut') {
                      if (checkIn && picked <= checkIn) {
                        showUiError('Check-out must be after check-in.');
                        return;
                      }

                      // overlap check
                      const time = bookingTime || '10:00';
                      if (checkIn && overlapsApproved(checkIn, picked, time, blocked)) {
                        showUiError('This stay overlaps an approved booking. Please change dates/time.');
                        return;
                      }

                      setCheckOut(picked);
                      setSelectedRoomQty({});
                      setGuestsByRoom({});
                      setPickerOpen(false);
                      return;
                    }
                  }}
                />
              ) : (
                <DateTimePicker
                  value={tempPickerValue}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    if (date) setTempPickerValue(date);
                  }}
                />
              )}

              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setPickerOpen(false)}>
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>

                {pickerMode === 'time' ? (
                  <TouchableOpacity style={styles.modalBtn} onPress={applyTimePicker}>
                    <Text style={styles.modalBtnText}>Done</Text>
                  </TouchableOpacity>
                ) : null}
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

  errorBanner: {
    backgroundColor: '#B00020',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffffff33',
  },
  errorBannerText: { color: '#fff', fontWeight: '800', flex: 1, fontSize: 13 },

  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 6 },
  label: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  requiredPill: { backgroundColor: '#2C2750', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  requiredPillText: { color: CREAM_INPUT, fontSize: 11, fontWeight: '600' },

  smallHint: { color: '#B8B0A5', fontSize: 12, marginTop: 8, fontStyle: 'italic' },

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

  primaryBtn: { marginTop: 16, backgroundColor: YELLOW, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryBtnText: { color: BTN_TEXT, fontSize: 14, fontWeight: '700' },

  secondaryBtn: { marginTop: 10, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: CARD_EDGE, backgroundColor: 'transparent' },
  secondaryBtnText: { color: CREAM_INPUT, fontSize: 14, fontWeight: '700' },

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

  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  popupCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#B00020',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffffff33',
    alignItems: 'center',
    gap: 10,
  },
  popupText: { color: '#fff', fontWeight: '800', textAlign: 'center', fontSize: 14, lineHeight: 18 },
  popupBtn: { marginTop: 6, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  popupBtnText: { color: '#B00020', fontWeight: '900' },
});
