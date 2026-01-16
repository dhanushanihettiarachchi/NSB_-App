// app/UploadSlip.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from './config';
import { useBookingDraft } from './context/BookingDraftContext';

const NAVY = '#020038';
const YELLOW = '#FFB600';
const MUTED = 'rgba(255,255,255,0.70)';
const MUTED2 = 'rgba(255,255,255,0.45)';

type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};

async function buildFormDataWeb(file: PickedFile, fields: Record<string, string>) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));

  const resp = await fetch(file.uri);
  const blob = await resp.blob();
  fd.append('file', blob, file.name);
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

  const bookingId = bookingIdParam || Number(draft?.booking_ids?.[0] || 0);
  const amount = amountParam || Number(draft?.grandTotal || 0);

  const [file, setFile] = useState<PickedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [hoverPickImage, setHoverPickImage] = useState(false);
  const [hoverPickPdf, setHoverPickPdf] = useState(false);

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
    } catch {
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
    } catch {
      Alert.alert('Error', 'Unable to pick PDF');
    }
  };

  const submit = async () => {
    if (!bookingId || !amount || !file) {
      Alert.alert('Error', 'Please complete all required steps.');
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

      if (!res.ok) {
        Alert.alert('Upload failed');
        return;
      }

      patchDraft({ paymentProofUploaded: true });
      setFile(null);
      router.replace('/PaymentSubmitted');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.topHeaderCard}>
            <Text style={styles.topTitle}>Upload Payment Slip</Text>
            <Text style={styles.topSub}>
              Transfer the payment using the details below, then upload your slip.
            </Text>
          </View>

          {/* ✅ UPDATED BANK DETAILS SECTION */}
          <View style={styles.bankCard}>
            <View style={styles.bankHeader}>
              <Ionicons name="business-outline" size={18} color={YELLOW} />
              <Text style={styles.bankTitle}>Bank Details</Text>
            </View>

            <View style={styles.bankItem}>
              <Text style={styles.bankLabel}>Bank</Text>
              <Text style={styles.bankValue}>Mock National Bank</Text>
            </View>

            <View style={styles.bankItem}>
              <Text style={styles.bankLabel}>Account Name</Text>
              <Text style={styles.bankValue}>R22 Booster (Pvt) Ltd</Text>
            </View>

            <View style={styles.bankItem}>
              <Text style={styles.bankLabel}>Account Number</Text>
              <Text style={styles.bankValue}>123 456 7890</Text>
            </View>

            <View style={styles.bankItem}>
              <Text style={styles.bankLabel}>Branch</Text>
              <Text style={styles.bankValue}>Colombo 07</Text>
            </View>
          </View>

          {/* Booking Summary */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Your Booking Summary</Text>
            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Amount</Text>
              <Text style={styles.kValue}>{amountText}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kLabel}>Method</Text>
              <Text style={styles.kValue}>Bank Transfer</Text>
            </View>
          </View>

          {/* Upload Proof */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Upload Proof</Text>

            <Pressable
              onPress={pickImage}
              onHoverIn={() => setHoverPickImage(true)}
              onHoverOut={() => setHoverPickImage(false)}
              style={[
                styles.actionBtnBase,
                hoverPickImage ? styles.actionBtnActive : styles.actionBtnIdle,
              ]}
            >
              <Ionicons
                name="image-outline"
                size={18}
                color={hoverPickImage ? NAVY : YELLOW}
              />
              <Text
                style={hoverPickImage ? styles.actionBtnTextActive : styles.actionBtnTextIdle}
              >
                Choose Image
              </Text>
            </Pressable>

            <Pressable
              onPress={pickPdf}
              onHoverIn={() => setHoverPickPdf(true)}
              onHoverOut={() => setHoverPickPdf(false)}
              style={[
                styles.actionBtnBase,
                { marginTop: 10 },
                hoverPickPdf ? styles.actionBtnActive : styles.actionBtnIdle,
              ]}
            >
              <Ionicons
                name="document-outline"
                size={18}
                color={hoverPickPdf ? NAVY : YELLOW}
              />
              <Text
                style={hoverPickPdf ? styles.actionBtnTextActive : styles.actionBtnTextIdle}
              >
                Choose PDF
              </Text>
            </Pressable>

            {file && (
              <View style={styles.fileBox}>
                <Ionicons name="attach-outline" size={16} color={YELLOW} />
                <Text style={styles.fileText}>{file.name}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={NAVY} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={NAVY} />
                  <Text style={styles.submitText}>Submit Proof</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  background: { flex: 1 },
  safe: { flex: 1 },

  container: { flex: 1, paddingHorizontal: '7%', paddingTop: 78, gap: 12 },

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

  topHeaderCard: {
    backgroundColor: 'rgba(10,10,26,0.88)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  topTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  topSub: { color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 6 },

  /* ✅ Updated bank styles */
  bankCard: {
    backgroundColor: 'rgba(79, 85, 112, 0.35)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bankHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  bankTitle: { color: '#fff', fontWeight: '900' },
  bankItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  bankLabel: { color: MUTED2, fontSize: 12, fontWeight: '700' },
  bankValue: { color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 2 },

  sectionCard: {
    backgroundColor: 'rgba(10,10,26,0.88)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  sectionTitle: { color: '#fff', fontWeight: '900', marginBottom: 10 },

  kvRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  kLabel: { color: MUTED2, fontSize: 12, fontWeight: '700' },
  kValue: { color: '#fff', fontSize: 12, fontWeight: '900' },

  actionBtnBase: {
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  actionBtnIdle: {
    borderColor: 'rgba(255,182,0,0.45)',
    backgroundColor: 'rgba(255,182,0,0.10)',
  },
  actionBtnActive: {
    borderColor: 'rgba(255,182,0,0.9)',
    backgroundColor: YELLOW,
  },
  actionBtnTextIdle: { color: '#fff', fontWeight: '900' },
  actionBtnTextActive: { color: NAVY, fontWeight: '900' },

  fileBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  fileText: { color: '#fff', fontWeight: '700' },

  submitBtn: {
    marginTop: 14,
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  submitText: { color: NAVY, fontWeight: '900' },
});
