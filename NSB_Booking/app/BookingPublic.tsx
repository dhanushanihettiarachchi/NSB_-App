// NSB_Booking/app/BookingPublic.tsx
// Public Booking Details Screen (QR Scan - NO LOGIN REQUIRED)

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { API_URL } from "../src/services/config";

const NAVY = "#020038";
const YELLOW = "#FFB600";
const CARD = "rgba(10,10,26,0.88)";
const CARD_EDGE = "rgba(255,255,255,0.10)";
const MUTED2 = "rgba(255,255,255,0.55)";

type PublicRoomRow = {
  booking_id: number;
  room_id: number;
  room_Name?: string | null;

  need_room_count: number;
  guest_count: number;

  max_Persons?: number | null;
  price_per_person?: number | null;
  room_description?: string | null;
};

type PublicBookingGroup = {
  booking_id?: number;
  circuit_Name?: string | null;
  city?: string | null;
  street?: string | null;

  check_in_date?: string | null;
  check_out_date?: string | null;
  booking_time?: string | null;

  purpose?: string | null;
  status?: string | null;
  created_date?: string | null;

  payment_amount?: number | null;
  payment_status?: string | null;
  payment_slip_path?: string | null;
  payment_slip_uploaded_date?: string | null;

  rooms?: PublicRoomRow[];
};

type ResolveResponse = {
  message?: string;
  booking?: any;
  bookingGroup?: PublicBookingGroup;
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "-";
  return String(iso).slice(0, 10);
};

const safeTrim = (v: any) => String(v ?? "").trim();

const fmtTime = (value?: string | null) => {
  if (!value) return "-";
  const s = String(value);

  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);

  const tIndex = s.indexOf("T");
  if (tIndex !== -1 && s.length >= tIndex + 6) {
    const hhmm = s.slice(tIndex + 1, tIndex + 6);
    if (/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  }

  const match = s.match(/(\d{2}:\d{2})/);
  if (match?.[1]) return match[1];

  return "-";
};

const normalizeStatus = (s: any) => {
  const v = String(s ?? "").trim().toLowerCase();
  if (v === "approved") return "Approved";
  if (v === "rejected") return "Rejected";
  return "Pending";
};

const diffNights = (checkIn?: string | null, checkOut?: string | null) => {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(String(checkIn).slice(0, 10));
  const b = new Date(String(checkOut).slice(0, 10));
  const ms = b.getTime() - a.getTime();
  const nights = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
};

export default function BookingPublic() {
  const params = useLocalSearchParams();

  // ✅ FIX: support both "token" and "qrToken"
  const token = useMemo(() => {
    return String((params.token ?? params.qrToken ?? "") as any).trim();
  }, [params.token, params.qrToken]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ResolveResponse | null>(null);

  const fetchDetails = async () => {
    if (!token || token.length < 20) {
      setLoading(false);
      setData(null);
      Alert.alert("Invalid QR", "Token is missing or invalid.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/qr-codes/resolve/${encodeURIComponent(token)}`);
      const json = (await res.json().catch(() => ({}))) as ResolveResponse;

      if (!res.ok) {
        console.log("resolve error:", json);
        Alert.alert("Error", json?.message || "Unable to load booking details");
        setData(null);
        return;
      }

      setData(json);
    } catch (e) {
      console.log("resolve fetch error:", e);
      Alert.alert("Network Error", "Cannot connect to server.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDetails();
    setRefreshing(false);
  };

  const group: PublicBookingGroup | null = useMemo(() => {
    if (data?.bookingGroup) return data.bookingGroup;

    const b = data?.booking;
    if (!b) return null;

    return {
      booking_id: b.booking_id,
      circuit_Name: b.circuit_Name,
      city: b.city,
      street: b.street,
      check_in_date: b.check_in_date,
      check_out_date: b.check_out_date,
      booking_time: b.booking_time,
      purpose: b.purpose,
      status: b.status,
      created_date: b.created_date,
      payment_amount: b.payment_amount,
      payment_status: b.payment_status,
      payment_slip_path: b.payment_slip_path,
      payment_slip_uploaded_date: b.payment_slip_uploaded_date,
      rooms: [
        {
          booking_id: b.booking_id,
          room_id: b.room_id,
          room_Name: b.room_Name,
          need_room_count: b.need_room_count,
          guest_count: b.guest_count,
          max_Persons: b.max_Persons,
          price_per_person: b.price_per_person,
          room_description: b.room_description,
        },
      ],
    };
  }, [data]);

  const rooms = group?.rooms || [];
  const statusLabel = normalizeStatus(group?.status);

  const statusPillStyle =
    statusLabel === "Approved"
      ? styles.badgeApproved
      : statusLabel === "Rejected"
      ? styles.badgeRejected
      : styles.badgePending;

  const nights = diffNights(group?.check_in_date, group?.check_out_date);

  const totalGuests = rooms.reduce((sum, r) => sum + Number(r.guest_count || 0), 0);
  const totalRooms = rooms.reduce((sum, r) => sum + Number(r.need_room_count || 0), 0);

  const estimatedTotal = useMemo(() => {
    if (!rooms.length || !nights) return 0;
    const perNight = rooms.reduce((sum, r) => {
      const guests = Number(r.guest_count || 0);
      const ppp = Number(r.price_per_person || 0);
      return sum + guests * ppp;
    }, 0);
    return perNight * nights;
  }, [rooms, nights]);

  const paymentLabel = useMemo(() => {
    const p = safeTrim(group?.payment_status);
    const hasSlip = !!group?.payment_slip_path;
    if (hasSlip) return "Payment Slip Uploaded";
    if (p) return `Payment: ${p}`;
    return "Payment Slip Not Uploaded";
  }, [group?.payment_status, group?.payment_slip_path]);

  const amountToShow =
    group?.payment_amount != null ? Number(group.payment_amount) : estimatedTotal || null;

  return (
    <LinearGradient colors={["#020038", "#05004A", "#020038"]} style={{ flex: 1 }}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>Booking Details</Text>
        <Text style={styles.subTitle}>Verified by QR Scan</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={YELLOW} />
            <Text style={styles.hint}>Loading booking...</Text>
          </View>
        ) : !group ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={36} color="#FFEBD3" />
            <Text style={styles.hint}>No booking details found for this QR.</Text>

            <TouchableOpacity style={styles.retryBtn} onPress={fetchDetails} activeOpacity={0.9}>
              <Ionicons name="refresh-outline" size={18} color={NAVY} />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 28 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{group.circuit_Name || "Circuit"}</Text>
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={14} color="#FFEBD3" />
                    <Text style={styles.locText}>
                      {(group.city || "") + (group.street ? ` • ${group.street}` : "")}
                    </Text>
                  </View>
                </View>

                <View style={[styles.badge, statusPillStyle]}>
                  <Text style={styles.badgeText}>{statusLabel}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Booking ID</Text>
                <Text style={styles.rowValue}>{group.booking_id != null ? String(group.booking_id) : "-"}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Check-in Date</Text>
                <Text style={styles.rowValue}>{fmtDate(group.check_in_date)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Check-out Date</Text>
                <Text style={styles.rowValue}>{fmtDate(group.check_out_date)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Check-in Time</Text>
                <Text style={styles.rowValue}>{fmtTime(group.booking_time)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Nights</Text>
                <Text style={styles.rowValue}>{String(nights || 0)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Guests</Text>
                <Text style={styles.rowValue}>{String(totalGuests || 0)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Rooms</Text>
                <Text style={styles.rowValue}>{String(totalRooms || 0)}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Cost</Text>
                <Text style={styles.rowValue}>
                  {amountToShow != null ? `Rs ${amountToShow}` : "-"}
                </Text>
              </View>

              {safeTrim(group.purpose) ? (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Purpose</Text>
                  <Text style={styles.sectionBody}>{safeTrim(group.purpose)}</Text>
                </>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Rooms</Text>

              {rooms.map((r, idx) => {
                const desc = safeTrim(r.room_description);
                const showDesc = desc.length > 0 && desc.toLowerCase() !== "null";

                return (
                  <View key={`${r.booking_id}_${idx}`} style={styles.roomCard}>
                    <View style={styles.roomPill}>
                      <Text style={styles.roomText}>{r.room_Name || `Room ${r.room_id}`}</Text>
                      <Text style={styles.roomTextSmall}>
                        {r.need_room_count ? `× ${r.need_room_count}` : ""}
                      </Text>
                    </View>

                    <View style={{ height: 10 }} />

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Room Count</Text>
                      <Text style={styles.rowValue}>{String(r.need_room_count ?? 0)}</Text>
                    </View>

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Guests Count</Text>
                      <Text style={styles.rowValue}>{String(r.guest_count ?? 0)}</Text>
                    </View>

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Max Persons</Text>
                      <Text style={styles.rowValue}>{r.max_Persons != null ? String(r.max_Persons) : "-"}</Text>
                    </View>

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Price / Person</Text>
                      <Text style={styles.rowValue}>
                        {r.price_per_person != null ? `Rs ${r.price_per_person}` : "-"}
                      </Text>
                    </View>

                    {showDesc ? (
                      <>
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>Room Description</Text>
                        <Text style={styles.sectionBody}>{desc}</Text>
                      </>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Payment</Text>

              <View style={styles.payBox}>
                <Ionicons
                  name={group.payment_slip_path ? "checkmark-circle-outline" : "cloud-upload-outline"}
                  size={18}
                  color={YELLOW}
                />
                <Text style={styles.payText}>{paymentLabel}</Text>
              </View>

              <View style={{ height: 10 }} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Amount</Text>
                <Text style={styles.rowValue}>{amountToShow != null ? `Rs ${amountToShow}` : "-"}</Text>
              </View>

              {group.payment_slip_uploaded_date ? (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Uploaded Date</Text>
                  <Text style={styles.rowValue}>{fmtDate(group.payment_slip_uploaded_date)}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.footerMeta}>
              <Text style={styles.tiny}>Created: {fmtDate(group.created_date)}</Text>
            </View>
          </ScrollView>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 70, paddingHorizontal: "6%" },

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

  title: { color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "center" },
  subTitle: {
    color: MUTED2,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  hint: { color: "#B8B0A5", fontWeight: "800", fontSize: 12, textAlign: "center" },
  tiny: { color: MUTED2, fontWeight: "700", fontSize: 11, textAlign: "center" },

  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    marginBottom: 12,
  },

  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },

  locRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  locText: { color: "#E2DCD2", fontSize: 12, fontWeight: "600" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgePending: { backgroundColor: "#5c4600" },
  badgeApproved: { backgroundColor: "#0f4d2f" },
  badgeRejected: { backgroundColor: "#5a1b1b" },
  badgeText: { color: "#FFEBD3", fontWeight: "900", fontSize: 11 },

  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.10)", marginVertical: 10 },

  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  rowLabel: { color: "#B8B0A5", fontWeight: "700", fontSize: 12 },
  rowValue: { color: "#EDE7DC", fontWeight: "900", fontSize: 12 },

  sectionTitle: { color: "#FFEBD3", fontWeight: "900", marginBottom: 8 },
  sectionBody: { color: "#EDE7DC", fontWeight: "700", fontSize: 12, lineHeight: 16 },

  roomCard: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  roomPill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roomText: { color: "#EDE7DC", fontWeight: "900", fontSize: 12 },
  roomTextSmall: { color: "#EDE7DC", fontWeight: "900", fontSize: 12, opacity: 0.9 },

  payBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  payText: { color: "#EDE7DC", fontWeight: "900", fontSize: 12 },

  retryBtn: {
    marginTop: 12,
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  retryText: { color: NAVY, fontWeight: "900" },

  footerMeta: { marginTop: 6, alignItems: "center", gap: 6, paddingBottom: 10 },
});