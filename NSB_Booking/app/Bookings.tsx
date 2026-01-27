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
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';
import { useBookingDraft } from './(context)/BookingDraftContext';

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
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  booking_time?: string | null; // "HH:mm" or null
  status: string; // Approved
};

type AvailabilityRow = {
  room_Id: number;
  room_Name: string;
  room_Count: number;
  booked_count: number;
  remaining: number;
  max_Persons: number;
  price_per_person: number;
};

const NAVY = '#020038';
const BLACK_BOX = '#050515';
const CREAM_INPUT = '#FFEBD3';
const YELLOW = '#FFB600';
const BTN_TEXT = '#00113D';

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

  if (typeof t === 'string') {
    const m = t.match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : fallback;
  }

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

// ------- date utils -------
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// checkout-day min time map: date -> latest checkout time on that date (circuit-level)
const buildCheckoutMinTimeMap = (blocked: BlockedRange[]) => {
  const map: Record<string, string> = {};
  blocked.forEach((b) => {
    if (String(b.status || '').toLowerCase() !== 'approved') return;
    const day = String(b.check_out_date || '').slice(0, 10);
    const t = normalizeBookingTimeHHMM(b.booking_time, '10:00');
    if (!map[day] || t > map[day]) map[day] = t;
  });
  return map;
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

  // ✅ still load blocked (ONLY for minTime rule display)
  const [blocked, setBlocked] = useState<BlockedRange[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // ✅ availability
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // ✅ fully booked days (circuit-level)
  const [fullyBookedDays, setFullyBookedDays] = useState<string[]>([]);
  const [loadingFullyBookedDays, setLoadingFullyBookedDays] = useState(false);


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
    setAvailability([]);
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

  // Load blocked approved ranges (ONLY for min time notes)
  useEffect(() => {
    const loadBlocked = async () => {
      if (!circuitId) return;
      try {
        setLoadingBlocked(true);
        const res = await fetch(
          `${API_URL}/bookings/unavailable?circuitId=${encodeURIComponent(circuitId)}`
        );
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

    // ✅ Load fully booked days (disable/red dates when ALL room types are full)
  useEffect(() => {
    const loadFullyBookedDays = async () => {
      if (!circuitId) return;

      try {
        setLoadingFullyBookedDays(true);

        const today = new Date();
        const from = formatDateYYYYMMDD(today);
        const to = formatDateYYYYMMDD(addDays(today, 365));

        const url =
          `${API_URL}/bookings/fully-booked-days` +
          `?circuitId=${encodeURIComponent(circuitId)}` +
          `&from=${encodeURIComponent(from)}` +
          `&to=${encodeURIComponent(to)}` +
          `&time=${encodeURIComponent(bookingTime || '10:00')}`;

        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));
        const days = Array.isArray(json.days) ? json.days : [];
        setFullyBookedDays(days);
      } catch (e) {
        console.log('load fullyBookedDays error:', e);
        setFullyBookedDays([]);
      } finally {
        setLoadingFullyBookedDays(false);
      }
    };

    loadFullyBookedDays();
  }, [circuitId, bookingTime]);


  const checkoutMinTimeMap = useMemo(() => buildCheckoutMinTimeMap(blocked), [blocked]);

  const minTimeForSelectedCheckIn = useMemo(() => {
    if (!checkIn) return null;
    return checkoutMinTimeMap[checkIn] || null;
  }, [checkIn, checkoutMinTimeMap]);

  // ✅ fetch availability whenever date/time changes (only if valid)
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!circuitId) return;

      // Need all three to compute correct overlap-by-time
      if (!checkIn || !checkOut || !bookingTime) {
        setAvailability([]);
        return;
      }
      if (checkOut <= checkIn) {
        setAvailability([]);
        return;
      }

      try {
        setLoadingAvailability(true);
        const url =
          `${API_URL}/bookings/availability` +
          `?circuitId=${encodeURIComponent(circuitId)}` +
          `&checkIn=${encodeURIComponent(checkIn)}` +
          `&checkOut=${encodeURIComponent(checkOut)}` +
          `&time=${encodeURIComponent(bookingTime || '10:00')}`;

        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));
        const list = (json.availability || []) as AvailabilityRow[];
        setAvailability(Array.isArray(list) ? list : []);
      } catch (e) {
        console.log('availability error:', e);
        setAvailability([]);
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [circuitId, checkIn, checkOut, bookingTime]);

  // availability map: room_Id -> remaining
  const remainingMap = useMemo(() => {
    const map: Record<number, number> = {};
    availability.forEach((a) => {
      map[a.room_Id] = Number(a.remaining) || 0;
    });
    return map;
  }, [availability]);

  const getRemainingForRoom = (room: Room) => {
    // before selecting date/time, allow full room_Count
    if (!checkIn || !checkOut || !bookingTime) return room.room_Count || 0;
    // after selecting date/time, use API remaining
    if (remainingMap[room.room_Id] == null) return 0; // safe: if not returned, treat as unavailable
    return Math.max(0, remainingMap[room.room_Id]);
  };

  // ✅ clamp selected qty if availability changes
  useEffect(() => {
    if (!checkIn || !checkOut || !bookingTime) return;

    setSelectedRoomQty((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.keys(next).forEach((k) => {
        const roomId = Number(k);
        const room = rooms.find((r) => r.room_Id === roomId);
        if (!room) return;

        const maxAllowed = getRemainingForRoom(room);
        const cur = next[roomId] || 0;

        if (maxAllowed <= 0) {
          // remove if no longer available
          delete next[roomId];
          changed = true;

          setGuestsByRoom((gprev) => {
            const g = { ...gprev };
            delete g[roomId];
            return g;
          });
          return;
        }

        if (cur > maxAllowed) {
          next[roomId] = maxAllowed;
          changed = true;

          setGuestsByRoom((gprev) => {
            const cap = maxAllowed * (room.max_Persons || 0);
            const currentGuests = gprev[roomId] || 0;
            if (currentGuests <= cap) return gprev;
            return { ...gprev, [roomId]: cap };
          });
        }
      });

      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, rooms]);

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

  const grandTotal = useMemo(() => perRoomTotals.reduce((sum, x) => sum + x.subtotal, 0), [perRoomTotals]);

  // ---- actions ----
  const addRoomType = (roomId: number) => {
    const room = rooms.find((r) => r.room_Id === roomId);
    if (!room) return;

    const remaining = getRemainingForRoom(room);
    if (remaining <= 0) {
      showUiError(`Room ${room.room_Name} is not available for selected dates/time.`);
      return;
    }

    setSelectedRoomQty((prev) => {
      if (prev[roomId] && prev[roomId] > 0) return prev;
      return { ...prev, [roomId]: 1 };
    });
    setGuestsByRoom((prev) => ({ ...prev, [roomId]: prev[roomId] ?? 0 }));
    setRoomPickerOpen(false);
  };

  const incQty = (room: Room) => {
    const maxAllowed = getRemainingForRoom(room);

    setSelectedRoomQty((prev) => {
      const current = prev[room.room_Id] || 0;
      const next = Math.min(maxAllowed, current + 1);

      if (next === current) {
        showUiError(
          checkIn && checkOut && bookingTime
            ? `Only ${maxAllowed} room(s) remaining for Room ${room.room_Name} on selected dates/time.`
            : `Only ${room.room_Count} rooms available for Room ${room.room_Name}.`
        );
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

  // ✅ validate checkout-day min time (kept)
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

    if (checkIn) {
      if (!validateMinTimeRule(checkIn, nextTime || '10:00')) {
        setPickerOpen(false);
        return;
      }
    }

    setBookingTime(nextTime);
    setPickerOpen(false);

    // reset room selection when time changes (optional but safer)
    setSelectedRoomQty({});
    setGuestsByRoom({});
  };

  // ---- validation ----
  const validate = () => {
    if (!checkIn) return 'Please select check-in date.';
    if (!checkOut) return 'Please select check-out date.';
    if (checkOut <= checkIn) return 'Check-out date must be after check-in date.';
    if (!nights) return 'Please select valid dates (at least 1 night).';

    if (!bookingTime) return 'Please select check-in time.';

    const time = bookingTime || '10:00';
    if (!validateMinTimeRule(checkIn, time)) return 'Please select a valid time.';

    if (selectedRoomsList.length === 0) return 'Please add at least one room type.';
    if (totalGuestsNum <= 0) return 'Please enter guests for at least one selected room type.';
    if (totalGuestsNum > totalCapacity) {
      return `Not enough capacity. Selected rooms can host ${totalCapacity}, but you entered ${totalGuestsNum} guests.`;
    }
    if (!grandTotal || grandTotal <= 0) return 'Total amount is 0. Please check guests and dates.';

    // ✅ Ensure not exceeding remaining (if availability loaded)
    if (checkIn && checkOut && bookingTime) {
      for (const { room, qty } of selectedRoomsList) {
        const remaining = getRemainingForRoom(room);
        if (qty > remaining) {
          return `Room ${room.room_Name} not enough available. Remaining=${remaining}, requested=${qty}.`;
        }
      }
    }

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

      const booking_ids: number[] = Array.isArray(data?.booking_ids) ? data.booking_ids : [];
      const bookingId = booking_ids[0] ? Number(booking_ids[0]) : 0;

      if (!bookingId) {
        showUiError('Booking submitted ✅ (Pending). You can upload payment slip later.');
        return;
      }

      const qrRes = await fetch(`${API_URL}/qr-codes/for-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const qrJson = await qrRes.json().catch(() => ({}));
      const qrValue = String(qrJson?.qr?.qr_code_data || '');

      router.push({
        pathname: '/BookingQR',
        params: {
          bookingId: String(bookingId),
          qrValue: qrValue || `myapp://UserBookings?bookingId=${bookingId}`,
        },
      });

      showUiError('Booking submitted ✅ (Pending). QR generated.');
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

  const fullyBookedDaysSet = useMemo(() => new Set(fullyBookedDays), [fullyBookedDays]);


  // ✅ build marked dates for mobile calendar (no disabling now)
  const markedDatesForMobile = useMemo(() => {
    const marked: any = {};

    if (checkIn) {
      marked[checkIn] = {
        selected: true,
        selectedColor: '#FFB600',
        customStyles: {
          container: { backgroundColor: '#FFB600', borderRadius: 8 },
          text: { color: '#00113D', fontWeight: '900' },
        },
      };
    }
    if (checkOut) {
      marked[checkOut] = {
        selected: true,
        selectedColor: '#2C2750',
        customStyles: {
          container: { backgroundColor: '#2C2750', borderRadius: 8 },
          text: { color: '#fff', fontWeight: '900' },
        },
      };
    }

    // (optional) highlight checkout-day min-time dates with yellow border
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

        // ✅ mark fully booked days as RED + disabled
    fullyBookedDaysSet.forEach((d) => {
      // don't overwrite selected styling if user already picked it
      if (marked[d]?.selected) return;

      marked[d] = {
        disabled: true,
        disableTouchEvent: true,
        customStyles: {
          container: { backgroundColor: '#B00020', borderRadius: 8, opacity: 0.35 },
          text: { color: '#fff', fontWeight: '900' },
        },
      };
    });

    return marked;
  }, [checkoutMinTimeMap, checkIn, checkOut, fullyBookedDaysSet]);


  // web helpers
  const webSelected = (s: string) => parseYYYYMMDD(s);

  // web set date handlers (no disable rule now)
  const setCheckInWeb = (d: Date | null) => {
    if (!d) return setCheckIn('');
    const picked = formatDateYYYYMMDD(d);

    if (fullyBookedDaysSet.has(picked)) {
    showUiError('This date is fully booked. Please select another date.');
    return;
    }


    setCheckIn(picked);

    if (!checkOut || checkOut <= picked) {
      const next = addDays(d, 1);
      const nextStr = formatDateYYYYMMDD(next);
      setCheckOut(nextStr);
    }

    // reset rooms selection when changing dates
    setSelectedRoomQty({});
    setGuestsByRoom({});
    setAvailability([]);
  };

  const setCheckOutWeb = (d: Date | null) => {
    if (!d) return setCheckOut('');
    const picked = formatDateYYYYMMDD(d);

    if (fullyBookedDaysSet.has(picked)) {
    showUiError('This date is fully booked. Please select another date.');
    return;
    }


    if (checkIn && picked <= checkIn) {
      showUiError('Check-out must be after check-in.');
      return;
    }
    setCheckOut(picked);

    setSelectedRoomQty({});
    setGuestsByRoom({});
    setAvailability([]);
  };

    
  // For react-datepicker (web) excludeDates must be Date[]
  const webExcludeDates = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = addDays(today, i);
      const ds = formatDateYYYYMMDD(d);
      if (fullyBookedDaysSet.has(ds)) out.push(d);
    }
    return out;
  }, [fullyBookedDaysSet]);

  const showAvailabilityHint = !!(checkIn && checkOut && bookingTime);

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.topCard}>
          <Text style={styles.circuitTitle}>{circuitName || 'Circuit'}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color={CREAM_INPUT} />
            <Text style={styles.locationText}>
              {city}
              {street ? ` • ${street}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Booking Details</Text>

          {(loadingBlocked && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingRowText}>Loading...</Text>
            </View>
          )) || null}

          {uiError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#fff" />
              <Text style={styles.errorBannerText}>{uiError}</Text>
            </View>
          ) : null}

          {/* Dates */}
          <Label text="Check-in Date" required />
          {Platform.OS === 'web' ? (
            WebDatePicker ? (
              <WebDatePicker
                selected={webSelected(checkIn)}
                onChange={setCheckInWeb}
                minDate={new Date()}
                excludeDates={webExcludeDates}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select a date"
                customInput={<input style={webInputStyle} />}
              />
            ) : (
              <Text style={styles.hint}>Install react-datepicker to show calendar on web.</Text>
            )
          ) : (
            <TouchableOpacity style={styles.pickerInput} onPress={() => openDatePicker('checkIn')} activeOpacity={0.9}>
              <View style={styles.pickerLeft}>
                <Ionicons name="calendar-outline" size={18} color={YELLOW} />
                <Text style={[styles.pickerText, !checkIn && styles.placeholder]}>{checkIn || 'Select a date'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          )}

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
                excludeDates={webExcludeDates}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select a date"
                customInput={<input style={webInputStyle} />}
              />
            ) : (
              <Text style={styles.hint}>Install react-datepicker to show calendar on web.</Text>
            )
          ) : (
            <TouchableOpacity style={styles.pickerInput} onPress={() => openDatePicker('checkOut')} activeOpacity={0.9}>
              <View style={styles.pickerLeft}>
                <Ionicons name="calendar-outline" size={18} color={YELLOW} />
                <Text style={[styles.pickerText, !checkOut && styles.placeholder]}>{checkOut || 'Select a date'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          )}

          {/* Time */}
          <Label text="Check-in Time" required />
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
                  if (checkIn && nextTime && !validateMinTimeRule(checkIn, nextTime || '10:00')) return;
                  setBookingTime(nextTime);

                  // reset selection when time changes (safer)
                  setSelectedRoomQty({});
                  setGuestsByRoom({});
                  setAvailability([]);
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
            <TouchableOpacity style={styles.pickerInput} onPress={openTimePicker} activeOpacity={0.9}>
              <View style={styles.pickerLeft}>
                <Ionicons name="time-outline" size={18} color={YELLOW} />
                <Text style={[styles.pickerText, !bookingTime && styles.placeholder]}>{bookingTime || 'Select time'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          )}

          {showAvailabilityHint && (
            <View style={styles.loadingRow}>
              {loadingAvailability ? <ActivityIndicator color="#fff" /> : <Ionicons name="information-circle" size={18} color="#fff" />}
              <Text style={styles.loadingRowText}>
                {loadingAvailability ? 'Checking available rooms...' : 'Showing room availability for selected dates/time.'}
              </Text>
            </View>
          )}

          {/* Rooms */}
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
                <View style={styles.pickerLeft}>
                  <Ionicons name="bed-outline" size={18} color={YELLOW} />
                  <Text style={styles.dropdownText}>
                    {selectedRoomsList.length === 0 ? 'Select room type(s)' : 'Add another room type'}
                  </Text>
                </View>
                <Ionicons
                  name={roomPickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="rgba(255,255,255,0.75)"
                />
              </TouchableOpacity>

              {roomPickerOpen && (
                <View style={styles.dropdownPanel}>
                  {rooms
                    .filter((r) => !selectedRoomQty[r.room_Id])
                    .filter((r) => getRemainingForRoom(r) > 0) // ✅ show only available
                    .map((r) => {
                      const rem = getRemainingForRoom(r);
                      return (
                        <TouchableOpacity
                          key={r.room_Id}
                          style={styles.dropdownItem}
                          onPress={() => addRoomType(r.room_Id)}
                          activeOpacity={0.9}
                        >
                          <View style={styles.dropdownItemTop}>
                            <Text style={styles.dropdownItemTitle}>Room {r.room_Name}</Text>
                            <View style={styles.smallPill}>
                              <Text style={styles.smallPillText}>{rem}</Text>
                            </View>
                          </View>

                          <Text style={styles.dropdownItemSub}>
                            Remaining {rem} • Max/room {r.max_Persons} • Rs {r.price_per_person}/person
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                  {rooms
                    .filter((r) => !selectedRoomQty[r.room_Id])
                    .filter((r) => getRemainingForRoom(r) > 0).length === 0 && (
                    <Text style={styles.hint}>
                      {showAvailabilityHint
                        ? 'No available room types for selected dates/time.'
                        : 'All room types are already added (or select dates/time first).'}
                    </Text>
                  )}
                </View>
              )}

              {selectedRoomsList.length > 0 && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {selectedRoomsList.map(({ room, qty }) => {
                    const maxAllowed = getRemainingForRoom(room);
                    const cap = qty * room.max_Persons;

                    return (
                      <View key={room.room_Id} style={styles.selectedRoomRow}>
                        <View style={styles.selectedRoomHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.selectedRoomTitle}>Room {room.room_Name}</Text>
                            <Text style={styles.selectedRoomSub}>
                              Remaining {maxAllowed} • Max/room {room.max_Persons} • Rs {room.price_per_person}/person
                            </Text>
                          </View>

                          <View style={styles.stepper}>
                            <TouchableOpacity
                              style={[styles.stepBtn, qty === 0 && { opacity: 0.6 }]}
                              onPress={() => decQty(room)}
                              disabled={qty === 0}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="remove" size={18} color={NAVY} />
                            </TouchableOpacity>

                            <View style={styles.stepCount}>
                              <Text style={styles.stepCountText}>{qty}</Text>
                            </View>

                            <TouchableOpacity
                              style={[styles.stepBtn, qty >= maxAllowed && { opacity: 0.6 }]}
                              onPress={() => incQty(room)}
                              activeOpacity={0.85}
                              disabled={qty >= maxAllowed}
                            >
                              <Ionicons name="add" size={18} color={NAVY} />
                            </TouchableOpacity>
                          </View>
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
            placeholderTextColor="rgba(255,255,255,0.45)"
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
          <Pressable
            onPress={submitBookingPayLater}
            disabled={submitting}
            style={({ pressed, hovered }) => [
              styles.secondaryBtn,
              (pressed || hovered) && styles.primaryBtn,
              submitting && { opacity: 0.7 },
            ]}
          >
            {({ pressed, hovered }) => {
              const active = pressed || hovered;

              return submitting ? (
                <>
                  <ActivityIndicator color={active ? NAVY : YELLOW} />
                  <Text style={[styles.secondaryBtnText, active && styles.primaryBtnText]}>Submitting...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={active ? NAVY : YELLOW} />
                  <Text style={[styles.secondaryBtnText, active && styles.primaryBtnText]}>
                    Submit Booking (Pay Later)
                  </Text>
                </>
              );
            }}
          </Pressable>

          <Pressable
            onPress={continueToPaymentNow}
            disabled={submitting}
            style={({ pressed, hovered }) => [
              styles.secondaryBtn,
              (pressed || hovered) && styles.primaryBtn,
              submitting && { opacity: 0.7 },
            ]}
          >
            {({ pressed, hovered }) => {
              const active = pressed || hovered;

              return (
                <>
                  <Ionicons name="card-outline" size={18} color={active ? NAVY : YELLOW} />
                  <Text style={[styles.secondaryBtnText, active && styles.primaryBtnText]}>Continue to Payment</Text>
                </>
              );
            }}
          </Pressable>

          {!!minTimeForSelectedCheckIn && (
            <Text style={styles.smallHint}>
              Note: On {checkIn}, check-in allowed only after {minTimeForSelectedCheckIn}.
            </Text>
          )}
        </View>

        {/* Center popup */}
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

        {/* Picker modal (Mobile uses Calendar for dates; DateTimePicker for time) */}
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

                      if (fullyBookedDaysSet.has(picked)) {
                      showUiError('This date is fully booked. Please select another date.');
                      return;
                      }

                      if (pickerTarget === 'checkIn') {
                        setCheckIn(picked);

                        if (!checkOut || checkOut <= picked) {
                          const d = parseYYYYMMDD(picked) || new Date();
                          const next = addDays(d, 1);
                          setCheckOut(formatDateYYYYMMDD(next));
                        }

                        setSelectedRoomQty({});
                        setGuestsByRoom({});
                        setAvailability([]);
                        setPickerOpen(false);
                        return;
                      }

                      if (pickerTarget === 'checkOut') {
                        if (checkIn && picked <= checkIn) {
                          showUiError('Check-out must be after check-in.');
                          return;
                        }
                        setCheckOut(picked);

                        setSelectedRoomQty({});
                        setGuestsByRoom({});
                        setAvailability([]);
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
                  <TouchableOpacity style={[styles.modalBtnGhost]} onPress={() => setPickerOpen(false)} activeOpacity={0.9}>
                    <Text style={styles.modalBtnGhostText}>Cancel</Text>
                  </TouchableOpacity>

                  {pickerMode === 'time' ? (
                    <TouchableOpacity style={styles.modalBtn} onPress={applyTimePicker} activeOpacity={0.9}>
                      <Text style={styles.modalBtnText}>Done</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </Modal>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: '6%',
    flexGrow: 1,
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

  topCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 22,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 7,
  },

  circuitTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },

  locationRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    alignItems: 'center',
  },

  locationText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '700',
  },

  formCard: {
    backgroundColor: 'rgba(10,10,26,0.88)',
    borderRadius: 22,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 7,
  },

  formTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },

  loadingRow: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  loadingRowText: {
    color: '#fff',
    fontWeight: '800',
    flex: 1,
  },

  errorBanner: {
    backgroundColor: '#ce3333',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffffff33',
  },

  errorBannerText: {
    color: '#fff',
    fontWeight: '900',
    flex: 1,
    fontSize: 13,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 6,
  },

  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  requiredPill: {
    backgroundColor: 'rgba(255,182,0,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.35)',
  },

  requiredPillText: {
    color: YELLOW,
    fontSize: 11,
    fontWeight: '900',
  },

  hint: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },

  smallHint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  pickerInput: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  pickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  pickerText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  placeholder: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '700',
  },

  input: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontWeight: '800',
  },

  textArea: {
    minHeight: 95,
    textAlignVertical: 'top',
    paddingTop: 12,
  },

  dropdown: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  dropdownText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  dropdownPanel: {
    marginTop: 10,
    backgroundColor: 'rgba(10,10,26,0.98)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 10,
  },

  dropdownItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  dropdownItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  dropdownItemTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    marginBottom: 6,
  },

  dropdownItemSub: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },

  smallPill: {
    backgroundColor: 'rgba(255,182,0,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.35)',
  },

  smallPillText: {
    color: YELLOW,
    fontWeight: '900',
    fontSize: 12,
  },

  selectedRoomRow: {
    backgroundColor: 'rgba(10,10,26,0.70)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  selectedRoomHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  selectedRoomTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  selectedRoomSub: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 16,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },

  stepBtn: {
    backgroundColor: YELLOW,
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepCount: {
    width: 44,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepCountText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  summaryCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,10,26,0.70)',
  },

  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },

  summaryLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '700',
  },

  summaryValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: 10,
  },

  roomSummaryCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  roomSummaryTitle: {
    color: YELLOW,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },

  totalLabel: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 14,
    fontWeight: '800',
  },

  totalValue: {
    color: YELLOW,
    fontSize: 18,
    fontWeight: '900',
  },

  summaryNote: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 14,
  },

  primaryBtn: {
    marginTop: 16,
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  primaryBtnText: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '900',
  },

  secondaryBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.45)',
    backgroundColor: 'rgba(255,182,0,0.10)',
  },

  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  submittingCard: {
    backgroundColor: 'rgba(10,10,26,0.98)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    gap: 10,
  },

  submittingTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'center',
  },

  submittingSub: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    textAlign: 'center',
  },

  modalCard: {
    backgroundColor: 'rgba(10,10,26,0.98)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  modalTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },

  modalBtns: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },

  modalBtn: {
    backgroundColor: YELLOW,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },

  modalBtnText: {
    color: NAVY,
    fontWeight: '900',
  },

  modalBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },

  modalBtnGhostText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

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
    backgroundColor: '#0066be',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffffff33',
    alignItems: 'center',
    gap: 10,
  },

  popupText: {
    color: '#fff',
    fontWeight: '900',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
  },

  popupBtn: {
    marginTop: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },

  popupBtnText: {
    color: '#B00020',
    fontWeight: '900',
  },
});
