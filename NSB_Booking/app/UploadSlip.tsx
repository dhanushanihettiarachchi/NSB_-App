// UploadSlip.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useBookingDraft } from './context/BookingDraftContext';
import { API_URL } from './config';

const NAVY = '#020038';
const BLACK_BOX = '#050515';
const CARD_EDGE = '#2C2750';
const CREAM_INPUT = '#FFEBD3';
const YELLOW = '#FFB600';
const BTN_TEXT = '#00113D';

type PickedFile = {
  uri: string;
  name: string;
  mimeType: string; // e.g. "application/pdf" or "image/jpeg"
  size?: number;
};

export default function UploadSlip() {
  const params = useLocalSearchParams();
  const { draft } = useBookingDraft();

  const { userId, bookingId, amount } = useMemo(() => {
    const userIdParam = String(params.userId ?? '').trim();
    const bookingIdParam = String(params.bookingId ?? '').trim();
    const amountParam = String(params.amount ?? '').trim();

    const u = userIdParam || String(draft?.userId ?? '').trim();
    const b = bookingIdParam || String(draft?.booking_ids?.[0] ?? '').trim();
    const a = amountParam || String(draft?.grandTotal ?? '').trim();

    return { userId: u, bookingId: b, amount: a };
  }, [params.userId, params.bookingId, params.amount, draft?.userId, draft?.booking_ids, draft?.grandTotal]);

  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickPdfOrImage = async () => {
    try {
      // ✅ Allow both images + PDF
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file?.uri) return;

      const name = file.name || `payment-proof-${bookingId || 'unknown'}`;
      const mimeType =
        file.mimeType ||
        (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      setPicked({
        uri: file.uri,
        name,
        mimeType,
        size: file.size,
      });
    } catch (e) {
      console.log('pickPdfOrImage error:', e);
      Alert.alert('Error', 'Unable to pick a file.');
    }
  };

  const uploadSlip = async () => {
    if (!userId) {
      Alert.alert('Missing User', 'User not found. Please login again.');
      router.replace('/SignIn');
      return;
    }

    if (!bookingId) {
      Alert.alert('Missing Booking', 'Booking ID not found. Please open My Bookings.');
      router.replace({ pathname: '/UserBookings', params: { userId } });
      return;
    }

    if (!picked?.uri) {
      Alert.alert('Upload required', 'Please choose a PDF or image as payment proof.');
      return;
    }

    if (uploading) return;

    setUploading(true);

    try {
      const formData = new FormData();

      /**
       * ✅ IMPORTANT (MATCH YOUR BACKEND routes/payments.js):
       * Backend uses: upload.single('file')
       * So the file field key MUST be "file"
       */
      formData.append('file' as any, {
        uri: picked.uri,
        name: picked.name,
        type: picked.mimeType,
      } as any);

      /**
       * ✅ IMPORTANT (MATCH YOUR BACKEND):
       * Backend expects: bookingId, amount, payment_method
       */
      formData.append('bookingId', String(bookingId));
      formData.append('amount', String(amount || ''));
      formData.append('payment_method', 'BankTransfer'); // <-- you can change label if you want

      const res = await fetch(`${API_URL}/payments/upload-slip`, {
        method: 'POST',
        headers: {
          // DO NOT set Content-Type manually for multipart uploads
          'x-user-id': String(userId),
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Upload failed', data?.message || 'Unable to upload payment proof.');
        return;
      }

      // ✅ Success → PaymentSubmitted
      router.replace({
        pathname: '/PaymentSubmitted',
        params: { userId: String(userId), bookingId: String(bookingId) },
      });
    } catch (e) {
      console.log('uploadSlip error:', e);
      Alert.alert('Error', 'Something went wrong while uploading.');
    } finally {
      setUploading(false);
    }
  };

  const fileTypeLabel = picked?.mimeType === 'application/pdf' ? 'PDF' : picked ? 'IMAGE' : '';

  return (
    <View style={styles.container}>
      {/* ✅ Back button */}
      <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.card}>
        <Ionicons name="cloud-upload-outline" size={46} color={YELLOW} />

        <Text style={styles.title}>Upload Payment Proof</Text>

        <Text style={styles.sub}>
          Booking ID: {bookingId || '-'}
          {'\n'}
          Amount: {amount ? `Rs ${amount}` : '-'}
        </Text>

        {/* Selected file info */}
        <View style={styles.fileBox}>
          {picked ? (
            <>
              <View style={styles.fileRow}>
                <Ionicons
                  name={picked.mimeType === 'application/pdf' ? 'document-text-outline' : 'image-outline'}
                  size={18}
                  color={YELLOW}
                />
                <Text style={styles.fileName} numberOfLines={2}>
                  {picked.name}
                </Text>
              </View>
              <Text style={styles.fileMeta}>
                Type: {fileTypeLabel} {picked.size ? `• ${(picked.size / 1024).toFixed(1)} KB` : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.fileHint}>No file selected (choose PDF or image)</Text>
          )}
        </View>

        {/* Choose file */}
        <TouchableOpacity style={styles.btnOutline} activeOpacity={0.9} onPress={pickPdfOrImage} disabled={uploading}>
          <Ionicons name="attach-outline" size={18} color={CREAM_INPUT} />
          <Text style={styles.btnOutlineText}>{picked ? 'Change File' : 'Choose PDF / Image'}</Text>
        </TouchableOpacity>

        {/* Upload */}
        <TouchableOpacity style={styles.btn} activeOpacity={0.9} onPress={uploadSlip} disabled={uploading}>
          {uploading ? (
            <>
              <ActivityIndicator color={NAVY} />
              <Text style={styles.btnText}> Uploading...</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={NAVY} />
              <Text style={styles.btnText}> Submit Payment Proof</Text>
            </>
          )}
        </TouchableOpacity>

        {Platform.OS === 'web' ? (
          <Text style={styles.smallNote}>
            Note: On web, file picking works, but some backends require extra handling for uploads.
          </Text>
        ) : null}
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
    gap: 12,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },

  sub: {
    color: '#B8B0A5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },

  fileBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  fileName: {
    flex: 1,
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },

  fileMeta: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '800',
    fontSize: 11,
  },

  fileHint: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '800',
    textAlign: 'center',
  },

  btn: {
    width: '100%',
    backgroundColor: YELLOW,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  btnText: {
    color: BTN_TEXT,
    fontWeight: '900',
  },

  btnOutline: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },

  btnOutlineText: {
    color: CREAM_INPUT,
    fontWeight: '900',
  },

  smallNote: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 4,
  },
});
