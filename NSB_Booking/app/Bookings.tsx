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

type Room = {
  room_Id: number;
  room_Name: string;
  room_Count: number;
  max_Persons: number;
  price_per_person: number;
};

const NAVY = '#020038';
const BLACK_BOX = '#050515';
const CREAM_INPUT = '#FFEBD3';
const YELLOW = '#FFB600';
const BTN_TEXT = '#00113D';
const CARD_EDGE = '#2C2750';
const PANEL = '#0A0830';

// ------- Web datepicker (calendar popup on web) -------
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

// web input styles (for react-datepicker custom input)
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

export default function Bookings() {
  const params = useLocalSearchParams();
  const circuitId = String(params.circuitId ?? '');
  const circuitName = String(params.circuitName ?? '');
  const city = String(params.city ?? '');
  const street = String(params.street ?? '');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Dates/time
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [bookingTime, setBookingTime] = useState('');

  // Purpose
  const [purpose, setPurpose] = useState('');

  // Selected room types and qty
  const [selectedRoomQty, setSelectedRoomQty] = useState<Record<number, number>>({});
  // Guests per room type (user inputs this; we compute totals from it)
  const [guestsByRoom, setGuestsByRoom] = useState<Record<number, number>>({});

  // Dropdowns
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);

  // Mobile picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerTarget, setPickerTarget] = useState<'checkIn' | 'checkOut' | 'time'>('checkIn');
  const [tempPickerValue, setTempPickerValue] = useState<Date>(new Date());

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

  // Total guests is calculated from guestsByRoom now
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

  // ---- actions ----
  const addRoomType = (roomId: number) => {
    const room = rooms.find((r) => r.room_Id === roomId);
    if (!room) return;

    setSelectedRoomQty((prev) => {
      if (prev[roomId] && prev[roomId] > 0) return prev; // already added
      return { ...prev, [roomId]: 1 };
    });

    // init guests for new room type
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
        // If qty reduced, clamp guests to new capacity
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
      setBookingTime(formatTimeHHMM(tempPickerValue));
      setPickerOpen(false);
      return;
    }

    const picked = formatDateYYYYMMDD(tempPickerValue);

    if (pickerTarget === 'checkIn') {
      setCheckIn(picked);
      if (!checkOut || checkOut <= picked) {
        const next = new Date(tempPickerValue);
        next.setDate(next.getDate() + 1);
        setCheckOut(formatDateYYYYMMDD(next));
      }
      setPickerOpen(false);
      return;
    }

    if (pickerTarget === 'checkOut') {
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

    // Guests are now per-room. Require total guests > 0 and within capacity.
    if (totalGuestsNum <= 0) return 'Please enter guests for at least one selected room type.';
    if (totalGuestsNum > totalCapacity) {
      return `Not enough capacity. Selected rooms can host ${totalCapacity}, but you entered ${totalGuestsNum} guests.`;
    }
    return null;
  };

  const submitBooking = () => {
    const err = validate();
    if (err) return Alert.alert('Validation', err);
    Alert.alert('Frontend Only', 'Form is valid ✅. Backend will be connected later.');
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
                        Available {r.room_Count} • Max/room {r.max_Persons} • Rs {r.price_per_person}
                        /person
                      </Text>
                    </TouchableOpacity>
                  ))}

                {rooms.filter((r) => !selectedRoomQty[r.room_Id]).length === 0 && (
                  <Text style={styles.hint}>All room types are already added.</Text>
                )}
              </View>
            )}

            {/* Selected room types with +/- qty + guests */}
            {selectedRoomsList.length > 0 && (
              <View style={{ marginTop: 12, gap: 10 }}>
                {selectedRoomsList.map(({ room, qty }) => {
                  const cap = qty * room.max_Persons;
                  return (
                    <View key={room.room_Id} style={styles.selectedRoomRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectedRoomTitle}>Room {room.room_Name}</Text>
                        <Text style={styles.selectedRoomSub}>
                          Available {room.room_Count} • Max/room {room.max_Persons} • Rs{' '}
                          {room.price_per_person}/person
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

                        <TouchableOpacity
                          style={styles.stepBtnCream}
                          onPress={() => incQty(room)}
                          activeOpacity={0.85}
                        >
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
                setCheckIn(picked);
                if (d) {
                  const next = new Date(d);
                  next.setDate(next.getDate() + 1);
                  if (!checkOut || checkOut <= picked) setCheckOut(formatDateYYYYMMDD(next));
                }
              }}
              minDate={new Date()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select a date"
              customInput={<input style={webInputStyle} />}
            />
          ) : (
            <Text style={styles.hint}>Install react-datepicker to show calendar on web.</Text>
          )
        ) : (
          <TouchableOpacity style={styles.pickerInput} onPress={() => openDatePicker('checkIn')}>
            <Text style={[styles.pickerText, !checkIn && styles.placeholder]}>
              {checkIn || 'Select a date'}
            </Text>
            <Ionicons name="calendar-outline" size={18} color="#2a2250" />
          </TouchableOpacity>
        )}

        <Label text="Check-out Date" required />
        {Platform.OS === 'web' ? (
          WebDatePicker ? (
            <WebDatePicker
              selected={webSelected(checkOut)}
              onChange={webSetDate(setCheckOut)}
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
              customInput={<input style={webInputStyle} />}
            />
          ) : (
            <Text style={styles.hint}>Install react-datepicker to show calendar on web.</Text>
          )
        ) : (
          <TouchableOpacity style={styles.pickerInput} onPress={() => openDatePicker('checkOut')}>
            <Text style={[styles.pickerText, !checkOut && styles.placeholder]}>
              {checkOut || 'Select a date'}
            </Text>
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
              onChange={(d: Date | null) => setBookingTime(d ? formatTimeHHMM(d) : '')}
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
            <Text style={[styles.pickerText, !bookingTime && styles.placeholder]}>
              {bookingTime || 'Select time'}
            </Text>
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

          <Text style={styles.summaryNote}>Total = nights × (guests in each room type) × price/person</Text>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={submitBooking}>
          <Ionicons name="paper-plane-outline" size={18} color={BTN_TEXT} />
          <Text style={styles.submitText}>Submit Booking Request</Text>
        </TouchableOpacity>

        <Text style={styles.footerHint}>Your request will be saved as Pending.</Text>
      </View>

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
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={() => setPickerOpen(false)}
                >
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
  headerBack: {
    position: 'absolute',
    top: 20,
    left: 16,
    zIndex: 10,
    padding: 4,
  },

  topCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: CARD_EDGE,
  },
  circuitTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  locationRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    alignItems: 'center',
  },
  locationText: {
    color: '#E2DCD2',
    fontSize: 13,
    fontWeight: '500',
  },

  formCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },

  // label + required badge
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  requiredPill: {
    backgroundColor: '#2C2750',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  requiredPillText: {
    color: CREAM_INPUT,
    fontSize: 11,
    fontWeight: '600',
  },

  smallHint: {
    color: '#B8B0A5',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },

  input: {
    backgroundColor: CREAM_INPUT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: BTN_TEXT,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: 12,
  },

  pickerInput: {
    backgroundColor: CREAM_INPUT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    color: BTN_TEXT,
    fontWeight: '600',
  },
  placeholder: {
    color: '#8b7d70',
    fontWeight: '500',
  },

  hint: {
    color: '#B8B0A5',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },

  dropdown: {
    backgroundColor: CREAM_INPUT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    color: BTN_TEXT,
    fontWeight: '600',
  },
  dropdownPanel: {
    marginTop: 10,
    backgroundColor: PANEL,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    gap: 8,
  },
  dropdownItem: {
    backgroundColor: BLACK_BOX,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: CARD_EDGE,
  },
  dropdownItemTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 4,
  },
  dropdownItemSub: {
    color: '#E2DCD2',
    fontSize: 12,
    fontWeight: '500',
  },

  selectedRoomRow: {
    backgroundColor: PANEL,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: CARD_EDGE,
  },
  selectedRoomTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  selectedRoomSub: {
    color: '#E2DCD2',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  // ✅ CREAM buttons for +/-
  stepBtnCream: {
    backgroundColor: CREAM_INPUT,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCountText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  summaryCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    backgroundColor: PANEL,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
    color: '#B8B0A5',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#EDE7DC',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: CARD_EDGE,
    marginVertical: 10,
  },
  roomSummaryCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: CARD_EDGE,
  },
  roomSummaryTitle: {
    color: CREAM_INPUT,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  totalLabel: {
    color: CREAM_INPUT,
    fontSize: 14,
    fontWeight: '600',
  },
  totalValue: {
    color: YELLOW,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryNote: {
    marginTop: 10,
    color: '#B8B0A5',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 14,
  },

  submitBtn: {
    marginTop: 16,
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitText: {
    color: BTN_TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  footerHint: {
    marginTop: 10,
    textAlign: 'center',
    color: '#B8B0A5',
    fontSize: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: BLACK_BOX,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: CARD_EDGE,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    borderRadius: 10,
  },
  modalBtnText: {
    color: BTN_TEXT,
    fontWeight: '700',
  },
  modalBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: CARD_EDGE,
  },
  modalBtnGhostText: {
    color: CREAM_INPUT,
    fontWeight: '600',
  },
});
