import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useBookingDraft } from './context/BookingDraftContext';


const NAVY = '#020038';
const BLACK_BOX = '#050515';
const CARD_EDGE = '#2C2750';
const CREAM_INPUT = '#FFEBD3';
const YELLOW = '#FFB600';
const BTN_TEXT = '#00113D';

export default function PaymentSubmitted() {
  const params = useLocalSearchParams();
  const userIdParam = String(params.userId ?? '');
  const bookingIdParam = String(params.bookingId ?? '');

  const { draft, clearDraft } = useBookingDraft();

  const userId = userIdParam || String(draft?.userId || '');
  const bookingId = bookingIdParam || String(draft?.booking_ids?.[0] || '');

  return (
    <View style={styles.container}>
      {/* ✅ Back button */}
      <TouchableOpacity
        style={styles.headerBack}
        onPress={() => router.back()}
        activeOpacity={0.9}
      >
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.card}>
        <Ionicons name="checkmark-circle-outline" size={50} color={YELLOW} />

        <Text style={styles.title}>Payment Proof Submitted ✅</Text>

        <Text style={styles.sub}>
          Your payment proof was uploaded successfully. Admin will review and
          approve/reject your booking.
        </Text>

        {/* ✅ Download QR Code */}
        <TouchableOpacity
          style={styles.btnOutline}
          activeOpacity={0.9}
          onPress={() => {
            if (!bookingId) {
              Alert.alert(
                'Missing Booking',
                'Booking ID not found. Please open My Bookings.'
              );
              clearDraft();
              router.replace({ pathname: '/UserBookings', params: { userId } });
              return;
            }

            clearDraft();

            router.replace({
              pathname: '/BookingQR',
              params: {
                userId,
                bookingId,
                title: 'Booking QR Code',
              },
            });
          }}
        >
          <Text style={styles.btnOutlineText}>Download QR Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '6%',
  },

  /* ✅ Back button style (same as you gave) */
  headerBack: {
    position: 'absolute',
    top: 30,
    left: 16,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    zIndex: 20,
  },

  card: {
    width: '100%',
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    alignItems: 'center',
    gap: 10,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },

  sub: {
    color: '#B8B0A5',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },

  btnOutline: {
    marginTop: 10,
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  btnOutlineText: {
    color: CREAM_INPUT,
    fontWeight: '900',
  },
});
