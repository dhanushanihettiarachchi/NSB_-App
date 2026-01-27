// app/PaymentMethod.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBookingDraft } from './(context)/BookingDraftContext';

const NAVY = '#020038';
const BLACK_BOX = '#050515';
const CARD_EDGE = '#2C2750';
const CREAM_INPUT = '#FFEBD3';
const YELLOW = '#FFB600';
const BTN_TEXT = '#00113D';

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>

      {/* ✅ React Native supports "\n" inside Text without CSS whiteSpace */}
      <Text
        style={[styles.rowValue, strong && styles.rowValueStrong]}
        numberOfLines={3}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
    </View>
  );
}

export default function PaymentMethod() {
  const { draft } = useBookingDraft();

  const amountText = useMemo(() => {
    const amt = Number(draft?.grandTotal || 0);
    return amt ? `Rs ${amt}` : '-';
  }, [draft?.grandTotal]);

  const circuitText = useMemo(() => {
    const name = draft?.circuitName ?? '';
    const city = draft?.city ?? '';
    const street = draft?.street ?? '';
    const line2 = [city, street].filter(Boolean).join(' · ');
    return line2 ? `${name}\n${line2}` : name || 'Circuit';
  }, [draft?.circuitName, draft?.city, draft?.street]);

  const datesText = useMemo(() => {
    const a = draft?.check_in_date ?? '';
    const b = draft?.check_out_date ?? '';
    if (!a && !b) return '-';
    if (a && b) return `${a} → ${b}`;
    return a || b;
  }, [draft?.check_in_date, draft?.check_out_date]);

  const nightsText = useMemo(() => {
    const n = Number(draft?.nights || 0);
    return n ? String(n) : '-';
  }, [draft?.nights]);

  const guestsText = useMemo(() => {
    const n = Number(draft?.totalGuests || 0);
    return n ? String(n) : '-';
  }, [draft?.totalGuests]);

  const roomsText = useMemo(() => {
    const n = Number(draft?.totalRooms || 0);
    return n ? String(n) : '-';
  }, [draft?.totalRooms]);

  const goUpload = () => {
    if (!draft) {
      Alert.alert('Error', 'Missing booking data. Please go back and try again.');
      return;
    }
    router.push('/UploadSlip');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>Payment Method</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Booking Summary</Text>

        <Row label="Circuit" value={circuitText} strong />
        <Row label="Dates" value={datesText} />
        <Row label="Nights" value={nightsText} />
        <Row label="Guests" value={guestsText} />
        <Row label="Rooms" value={roomsText} />
        <Row label="Amount" value={amountText} strong />

        <View style={styles.divider} />

        <Text style={styles.noteTitle}>How to Pay</Text>
        <Text style={styles.noteText}>
          Payment is done outside the system (Bank Transfer).{'\n'}
          Upload your bank slip image or PDF as proof.
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={goUpload} activeOpacity={0.9}>
          <Ionicons name="cloud-upload-outline" size={18} color={BTN_TEXT} />
          <Text style={styles.primaryBtnText}>Upload Payment Slip</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.outlineBtn} onPress={() => router.back()} activeOpacity={0.9}>
          <Text style={styles.outlineBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    paddingTop: 60,
    paddingHorizontal: '6%',
  },
  headerBack: {
    position: 'absolute',
    top: 20,
    left: 16,
    zIndex: 10,
    padding: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 14,
  },
  card: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_EDGE,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginVertical: 4,
  },
  rowLabel: {
    color: '#B8B0A5',
    fontWeight: '700',
    fontSize: 12,
    width: 90,
  },
  rowValue: {
    color: '#EDE7DC',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
    flexShrink: 1,
    lineHeight: 16,
  },
  rowValueStrong: {
    color: CREAM_INPUT,
    fontWeight: '900',
  },

  divider: {
    height: 1,
    backgroundColor: CARD_EDGE,
    marginVertical: 12,
  },

  noteTitle: {
    color: CREAM_INPUT,
    fontWeight: '900',
    marginBottom: 6,
  },
  noteText: {
    color: '#B8B0A5',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },

  primaryBtn: {
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: {
    color: BTN_TEXT,
    fontWeight: '900',
  },

  outlineBtn: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  outlineBtnText: {
    color: CREAM_INPUT,
    fontWeight: '900',
  },
});
