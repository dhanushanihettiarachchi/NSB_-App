// NSB_Booking/app/BookingQR.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import * as Sharing from "expo-sharing";
import * as FileSystem from 'expo-file-system/legacy';


const NAVY = "#020038";
const YELLOW = "#FFB600";
const MUTED = "rgba(255,255,255,0.70)";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function BookingQR() {
  const params = useLocalSearchParams();

  const bookingId = String(params.bookingId ?? "");
  const title = String(params.title ?? "Booking QR Code");

  const svgRef = useRef<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [qrValue, setQrValue] = useState<string>("");

  const fallbackQr = useMemo(() => {
    if (!bookingId) return "NSB_BOOKING|MISSING_BOOKING_ID";
    return `NSB_BOOKING|BOOKING_ID=${bookingId}`;
  }, [bookingId]);

  useEffect(() => {
    const load = async () => {
      try {
        if (!bookingId) {
          setQrValue(fallbackQr);
          return;
        }
        if (!API_URL) {
          Alert.alert("Config Error", "EXPO_PUBLIC_API_URL is not set");
          setQrValue(fallbackQr);
          return;
        }

        const resp = await fetch(`${API_URL}/qr-codes/for-booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: Number(bookingId) }),
        });

        const json = await resp.json().catch(() => ({}));
        const link = json?.qr?.qr_code_data;

        if (!resp.ok || !link) {
          console.log("QR API error:", json);
          setQrValue(fallbackQr);
          return;
        }

        setQrValue(String(link)); // http(s)://.../qr-codes/r/<token>
      } catch (e: any) {
        console.log("QR fetch error:", e);
        setQrValue(fallbackQr);
      }
    };

    load();
  }, [bookingId, fallbackQr]);

  const downloadQr = async () => {
    try {
      setDownloading(true);

      const base64: string = await new Promise((resolve) => {
        svgRef.current?.toDataURL((data: string) => resolve(data));
      });

      if (!base64 || base64.length < 50) {
        Alert.alert("Error", "QR image generation failed (empty output).");
        return;
      }

      if (Platform.OS === "web") {
        const href = `data:image/png;base64,${base64}`;
        const a = document.createElement("a");
        a.href = href;
        a.download = `booking_${bookingId || "qr"}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const dir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
      const fileUri = `${dir}booking_${bookingId || "qr"}_${Date.now()}.png`;

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: "base64" as any,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Saved", `QR saved at:\n${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, { mimeType: "image/png" });
    } catch (e: any) {
      console.log("downloadQr error:", e);
      Alert.alert("Error", e?.message || "Unable to download QR");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <LinearGradient colors={["#020038", "#05004A", "#020038"]} style={{ flex: 1 }}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.topCard}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>Scan this QR to open booking details</Text>
        </View>

        <View style={styles.qrCard}>
          <QRCode
            value={qrValue || fallbackQr}
            size={220}
            quietZone={14}
            backgroundColor="#FFFFFF"
            color="#000000"
            getRef={(c) => (svgRef.current = c)}
          />

          <Text style={styles.meta}>Booking ID: {bookingId || "-"}</Text>

          <TouchableOpacity
            style={[styles.btn, downloading && { opacity: 0.7 }]}
            onPress={downloadQr}
            activeOpacity={0.9}
            disabled={downloading}
          >
            <Ionicons name="download-outline" size={18} color={NAVY} />
            <Text style={styles.btnText}>{downloading ? "Preparing..." : "Download QR"}</Text>
          </TouchableOpacity>

          <Text style={styles.smallNote}>
            Scan with phone camera. It opens a link and redirects into the app automatically.
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: "6%" },

  headerBack: {
    position: "absolute",
    top: 30,
    left: 16,
    zIndex: 10,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  topCard: {
    backgroundColor: "rgba(10,10,26,0.88)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  title: { color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "center" },
  sub: { color: MUTED, fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 6 },

  qrCard: {
    marginTop: 18,
    backgroundColor: "rgba(10,10,26,0.88)",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
  },

  meta: { marginTop: 14, color: "#fff", fontWeight: "900" },

  btn: {
    marginTop: 14,
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  btnText: { color: NAVY, fontWeight: "900" },

  smallNote: {
    marginTop: 12,
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 15,
  },
});
