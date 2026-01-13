// app/UploadSlip.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { API_URL } from './config';
import { useBookingDraft } from './context/BookingDraftContext';

const NAVY = '#020038';
const BLACK_BOX = '#050515';
const CARD_EDGE = '#2C2750';
const CREAM_INPUT = '#FFEBD3';
const YELLOW = '#FFB600';
const BTN_TEXT = '#00113D';

type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};

async function buildFormDataWeb(file: PickedFile, fields: Record<string, string>) {
  // On web, file.uri is often blob:http://...
  const fd = new FormData();

  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));

  const resp = await fetch(file.uri);
  const blob = await resp.blob();
  fd.append('file', blob, file.name); // ✅ field must be "file"
  return fd;
}

function buildFormDataNative(file: PickedFile, fields: Record<string, string>) {
  const fd: any = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));

  fd.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  });

  return fd;
}

export default function UploadSlip() {
  const params = useLocalSearchParams();
  const bookingIdParam = Number(params.bookingId ?? 0);
  const amountParam = Number(params.amount ?? 0);

  const { draft, patchDraft } = useBookingDraft();

  // bookingId priority: route param -> draft.booking_ids[0]
  const bookingId = bookingIdParam || Number(draft?.booking_ids?.[0] || 0);

  // amount priority: route param -> draft.grandTotal
  const amount = amountParam || Number(draft?.grandTotal || 0);

  const [file, setFile] = useState<PickedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountText = useMemo(() => {
    return amount ? `Rs ${amount}` : '-';
  }, [amount]);

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow gallery access.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const name = asset.fileName || `slip_${Date.now()}.jpg`;
      setFile({ uri: asset.uri, name, mimeType: asset.mimeType || 'image/jpeg' });
    } catch (e) {
      console.log('pickImage error:', e);
      Alert.alert('Error', 'Unable to pick image');
    }
  };

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;
      const doc = result.assets?.[0];
      if (!doc?.uri) return;

      setFile({
        uri: doc.uri,
        name: doc.name || `slip_${Date.now()}.pdf`,
        mimeType: doc.mimeType || 'application/pdf',
        size: doc.size,
      });
    } catch (e) {
      console.log('pickPdf error:', e);
      Alert.alert('Error', 'Unable to pick PDF');
    }
  };

  const submit = async () => {
    if (!bookingId) {
      Alert.alert('Error', 'Missing bookingId. Please go back and try again.');
      return;
    }
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Amount is 0. Please go back and try again.');
      return;
    }
    if (!file) {
      Alert.alert('Required', 'Please upload payment proof (image or PDF).');
      return;
    }

    setSubmitting(true);

    try {
      const fields = {
        bookingId: String(bookingId),
        amount: String(amount),
        payment_method: 'Bank Transfer',
      };

      const formData =
        Platform.OS === 'web'
          ? await buildFormDataWeb(file, fields)
          : buildFormDataNative(file, fields);

      const res = await fetch(`${API_URL}/payments/upload-slip`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      console.log('upload-slip response:', { ok: res.ok, status: res.status, data });

      if (!res.ok) {
        Alert.alert('Upload failed', data?.message || 'Server error');
        return;
      }

      patchDraft({ paymentProofUploaded: true });
      setFile(null);

      router.replace('/PaymentSubmitted');
    } catch (e) {
      console.log('submit error:', e);
      Alert.alert('Error', 'Unable to submit slip');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>Upload Payment Slip</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Amount</Text>
          <Text style={styles.value}>{amountText}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Method</Text>
          <Text style={styles.value}>Bank Transfer</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Upload Proof</Text>

        <TouchableOpacity style={styles.pickBtn} onPress={pickImage} activeOpacity={0.9}>
          <Ionicons name="image-outline" size={18} color={BTN_TEXT} />
          <Text style={styles.pickBtnText}>Choose Image</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.pickBtnOutline} onPress={pickPdf} activeOpacity={0.9}>
          <Ionicons name="document-outline" size={18} color={CREAM_INPUT} />
          <Text style={styles.pickBtnOutlineText}>Choose PDF</Text>
        </TouchableOpacity>

        {file ? (
          <View style={styles.fileBox}>
            <Ionicons name="attach-outline" size={16} color={CREAM_INPUT} />
            <Text style={styles.fileText} numberOfLines={2}>
              {file.name}
            </Text>
          </View>
        ) : (
          <Text style={styles.hint}>No file selected yet.</Text>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={submit}
          disabled={submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <>
              <ActivityIndicator color={BTN_TEXT} />
              <Text style={styles.submitText}>Submitting...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color={BTN_TEXT} />
              <Text style={styles.submitText}>Submit Proof</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footerHint}>
          {Platform.OS === 'web'
            ? 'Tip: PDF upload works best on web. Image upload works everywhere.'
            : 'Tip: Upload a clear image or PDF of the bank slip.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY, paddingTop: 60, paddingHorizontal: '6%' },
  backBtn: { position: 'absolute', top: 20, left: 16, padding: 4, zIndex: 10 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 14 },
  card: { backgroundColor: BLACK_BOX, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: CARD_EDGE },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  label: { color: '#B8B0A5', fontWeight: '700', fontSize: 12 },
  value: { color: '#EDE7DC', fontWeight: '900', fontSize: 12 },
  divider: { height: 1, backgroundColor: CARD_EDGE, marginVertical: 10 },
  sectionTitle: { color: CREAM_INPUT, fontWeight: '900', marginBottom: 10 },

  pickBtn: { backgroundColor: YELLOW, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  pickBtnText: { color: BTN_TEXT, fontWeight: '900' },

  pickBtnOutline: { marginTop: 10, borderWidth: 1, borderColor: CARD_EDGE, backgroundColor: 'transparent', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  pickBtnOutlineText: { color: CREAM_INPUT, fontWeight: '900' },

  fileBox: { marginTop: 12, borderWidth: 1, borderColor: CARD_EDGE, borderRadius: 10, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  fileText: { color: '#EDE7DC', fontWeight: '700', flex: 1 },
  hint: { marginTop: 10, color: '#B8B0A5', fontStyle: 'italic', fontWeight: '600', fontSize: 12 },

  submitBtn: { marginTop: 14, backgroundColor: YELLOW, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  submitText: { color: BTN_TEXT, fontWeight: '900' },

  footerHint: { marginTop: 10, color: '#B8B0A5', fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 16 },
});
