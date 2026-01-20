// app/UserBookings.tsx
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
import { API_URL } from "./config";
import { useBookingDraft } from "./context/BookingDraftContext";

const NAVY = "#020038";
const BLACK_BOX = "#050515";
const CARD_EDGE = "#2C2750";
const PANEL = "#0A0830";
const CREAM_INPUT = "#FFEBD3";
const YELLOW = "#FFB600";
const BTN_TEXT = "#00113D";

type BookingRow = {
  booking_id: number;
  user_id: number;
  room_id: number;
  booking_date: string;
  check_in_date: string;
  check_out_date: string;
  booking_time?: string | null;
  guest_count: number;
  purpose?: string | null;
  status: string;
  created_date: string;

  need_room_count: number;

  room_Name?: string;
  circuit_Name?: string;
  city?: string;
  street?: string;

  // ✅ IMPORTANT: backend must return this (join Rooms)
  price_per_person?: number;

  // ✅ IMPORTANT: backend returns these already in your query
  rejected_by?: number | null;
  rejected_date?: string | null;
  rejection_reason?: string | null;

  approved_by?: number | null;
  approved_date?: string | null;
};

type Filter = "Pending" | "Approved" | "Rejected" | "All";

function normalizeStatus(s: any): Filter {
  const v = String(s || "").toLowerCase();
  if (v === "pending") return "Pending";
  if (v === "approved") return "Approved";
  if (v === "rejected") return "Rejected";
  return "All";
}

const fmtDate = (iso: string) => {
  if (!iso) return "";
  return String(iso).slice(0, 10);
};

const diffNights = (checkIn: string, checkOut: string) => {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  const ms = b.getTime() - a.getTime();
  const nights = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
};

export default function UserBookings() {
  const params = useLocalSearchParams();
  const userId = Number(params.userId ?? 0);

  // ✅ ADDED ONLY: bookingId coming from QR deep link
  const bookingIdFromQR = Number(params.bookingId ?? 0);

  const { setDraft } = useBookingDraft();

  const [filter, setFilter] = useState<Filter>("Pending");
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // booking_id -> { hasSlip, status, slipPath }
  const [payMap, setPayMap] = useState<
    Record<string, { hasSlip: boolean; status?: string; slipPath?: string }>
  >({});

  const fetchBookings = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/bookings/user/${userId}`);
      const json = await res.json().catch(() => ({}));
      const list = (json.bookings || []) as BookingRow[];

      setRows(list);

      // ✅ payment status for all booking ids
      const ids = list
        .map((x) => x.booking_id)
        .filter((n) => Number.isInteger(n) && n > 0);

      if (ids.length) {
        const payRes = await fetch(
          `${API_URL}/payments/status-bulk?ids=${ids.join(",")}`
        );
        const payJson = await payRes.json().catch(() => ({}));
        setPayMap(payJson.map || {});
      } else {
        setPayMap({});
      }
    } catch (e) {
      console.log("fetchBookings error:", e);
      Alert.alert("Error", "Unable to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  // ✅ ADDED ONLY: if opened via QR, show All automatically
  useEffect(() => {
    if (bookingIdFromQR) setFilter("All");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingIdFromQR]);

  // group rows by "same request": check-in + check-out + created_date + circuit
  const groups = useMemo(() => {
    const map = new Map<string, BookingRow[]>();

    for (const r of rows) {
      const key = [
        fmtDate(r.check_in_date),
        fmtDate(r.check_out_date),
        fmtDate(r.created_date),
        String(r.circuit_Name || ""),
      ].join("|");

      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }

    const out = Array.from(map.entries()).map(([key, list]) => ({
      key,
      rows: list.sort((a, b) => a.booking_id - b.booking_id),
    }));

    out.sort((a, b) =>
      (b.rows[0]?.created_date || "").localeCompare(a.rows[0]?.created_date || "")
    );

    return out;
  }, [rows]);

  const filteredGroups = useMemo(() => {
    if (filter === "All") return groups;
    return groups.filter((g) => normalizeStatus(g.rows[0]?.status) === filter);
  }, [groups, filter]);

  // ✅ ADDED ONLY: move QR matching group to top
  const qrFocusedGroups = useMemo(() => {
    if (!bookingIdFromQR) return filteredGroups;

    const match = groups.find((g) =>
      g.rows.some((r) => r.booking_id === bookingIdFromQR)
    );
    if (!match) return filteredGroups;

    const rest = filteredGroups.filter((x) => x.key !== match.key);
    return [match, ...rest];
  }, [bookingIdFromQR, groups, filteredGroups]);

  // ✅ compute estimated total from group rows
  const computeGrandTotal = (gRows: BookingRow[]) => {
    if (!gRows.length) return 0;

    const first = gRows[0];
    const nights = diffNights(
      fmtDate(first.check_in_date),
      fmtDate(first.check_out_date)
    );
    if (!nights) return 0;

    // Σ(guest_count * price_per_person) * nights
    const sumPerNight = gRows.reduce((sum, r) => {
      const guests = Number(r.guest_count || 0);
      const ppp = Number(r.price_per_person || 0);
      return sum + guests * ppp;
    }, 0);

    return sumPerNight * nights;
  };

  // ✅ detect slip uploaded for the whole group (ANY booking_id in group)
  const groupHasSlip = (gRows: BookingRow[]) => {
    return gRows.some((r) => !!payMap[String(r.booking_id)]?.hasSlip);
  };

  // ✅ get rejection reason from ANY row in group
  const getGroupRejectionReason = (gRows: BookingRow[]) => {
    const found = gRows.find(
      (r) => String(r.rejection_reason || "").trim().length > 0
    );
    return found ? String(found.rejection_reason).trim() : "";
  };

  const goUploadSlip = (g: { rows: BookingRow[] }) => {
    const first = g.rows[0];
    const booking_ids = g.rows.map((x) => x.booking_id);

    const nights = diffNights(
      fmtDate(first.check_in_date),
      fmtDate(first.check_out_date)
    );
    const totalGuests = g.rows.reduce((s, x) => s + (x.guest_count || 0), 0);
    const totalRooms = g.rows.reduce((s, x) => s + (x.need_room_count || 0), 0);

    const grandTotal = computeGrandTotal(g.rows);

    const hasAnyPrice = g.rows.some((r) => Number(r.price_per_person || 0) > 0);
    if (!hasAnyPrice) {
      Alert.alert(
        "Missing price",
        "Your API did not return price_per_person, so total cannot be calculated. Please update /bookings/user/:id query to include Rooms.price_per_person."
      );
      return;
    }

    setDraft({
      userId: first.user_id,
      circuitId: "",
      circuitName: first.circuit_Name || "",
      city: first.city || "",
      street: first.street || "",
      check_in_date: fmtDate(first.check_in_date),
      check_out_date: fmtDate(first.check_out_date),
      booking_time: first.booking_time || null,
      purpose: first.purpose || null,
      nights,
      totalGuests,
      totalRooms,
      grandTotal,
      booking_ids,
      paymentProofUploaded: false,
      items: g.rows.map((x) => ({
        room_id: x.room_id,
        room_name: x.room_Name || `Room ${x.room_id}`,
        need_room_count: x.need_room_count,
        guest_count: x.guest_count,
        max_persons: 0,
        price_per_person: Number(x.price_per_person || 0),
      })),
    });

    router.push({
      pathname: "/UploadSlip",
      params: {
        userId: String(userId),
        bookingId: String(first.booking_id),
        amount: String(grandTotal),
      },
    });
  };

  return (
    <View style={styles.container}>
      {/* ✅ UPDATED BACK BUTTON (new style) */}
      <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
        <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>My Bookings</Text>

      <View style={styles.filters}>
        {(["Pending", "Approved", "Rejected", "All"] as Filter[]).map((f) => {
          const active = f === filter;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
              activeOpacity={0.9}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={YELLOW} />
          <Text style={styles.hint}>Loading bookings...</Text>
        </View>
      ) : qrFocusedGroups.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="briefcase-outline" size={36} color={CREAM_INPUT} />
          <Text style={styles.hint}>No bookings found for this filter.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 26 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {qrFocusedGroups.map((g) => {
            const first = g.rows[0];
            const nights = diffNights(
              fmtDate(first.check_in_date),
              fmtDate(first.check_out_date)
            );
            const totalGuests = g.rows.reduce((s, x) => s + (x.guest_count || 0), 0);
            const totalRooms = g.rows.reduce((s, x) => s + (x.need_room_count || 0), 0);

            const grandTotal = computeGrandTotal(g.rows);
            const hasSlip = groupHasSlip(g.rows);
            const statusLabel = normalizeStatus(first.status);

            const rejectionReason =
              statusLabel === "Rejected" ? getGroupRejectionReason(g.rows) : "";

            const isQrMatch =
              !!bookingIdFromQR &&
              g.rows.some((r) => r.booking_id === bookingIdFromQR);

            return (
              <View
                key={g.key}
                style={[styles.card, isQrMatch && styles.cardHighlight]} // ✅ ADDED ONLY
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {first.circuit_Name || "Circuit"}
                    </Text>
                    <View style={styles.locRow}>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color={CREAM_INPUT}
                      />
                      <Text style={styles.locText}>
                        {(first.city || "") +
                          (first.street ? ` - ${first.street}` : "")}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.badge,
                      statusLabel === "Approved"
                        ? styles.badgeApproved
                        : statusLabel === "Rejected"
                        ? styles.badgeRejected
                        : styles.badgePending,
                    ]}
                  >
                    <Text style={styles.badgeText}>{statusLabel}</Text>
                  </View>
                </View>

                {/* ✅ SHOW REJECTION REASON */}
                {statusLabel === "Rejected" && (
                  <View style={styles.rejectBox}>
                    <Text style={styles.rejectTitle}>Rejection Reason</Text>
                    <Text style={styles.rejectText}>
                      {rejectionReason || "No reason provided by admin."}
                    </Text>
                  </View>
                )}

                <View style={styles.divider} />

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Check-in</Text>
                  <Text style={styles.rowValue}>{fmtDate(first.check_in_date)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Check-out</Text>
                  <Text style={styles.rowValue}>{fmtDate(first.check_out_date)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Nights</Text>
                  <Text style={styles.rowValue}>{String(nights)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Total Guests</Text>
                  <Text style={styles.rowValue}>{String(totalGuests)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Rooms Selected</Text>
                  <Text style={styles.rowValue}>{String(totalRooms)}</Text>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>Rooms</Text>
                {g.rows.map((r) => (
                  <View key={String(r.booking_id)} style={styles.roomPill}>
                    <Text style={styles.roomPillText}>
                      {(r.room_Name || `Room ${r.room_id}`) + ` × ${r.need_room_count}`}
                    </Text>
                    <Text style={styles.roomPillText}>Guests {r.guest_count}</Text>
                  </View>
                ))}

                <View style={styles.divider} />

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Estimated Total</Text>
                  <Text style={styles.totalValue}>
                    {grandTotal ? `Rs ${grandTotal}` : "-"}
                  </Text>
                </View>

                {/* Payment state */}
                {hasSlip ? (
                  <View style={styles.paidBox}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={YELLOW}
                    />
                    <Text style={styles.paidText}>Payment Proof Uploaded</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.payBtn}
                    activeOpacity={0.9}
                    onPress={() => goUploadSlip(g)}
                  >
                    <Ionicons
                      name="cloud-upload-outline"
                      size={18}
                      color={BTN_TEXT}
                    />
                    <Text style={styles.payBtnText}>
                      Upload Payment Slip (Pay Now)
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.createdText}>
                  Created: {fmtDate(first.created_date)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    paddingTop: 60,
    paddingHorizontal: "6%",
  },

  /* ✅ Back button style (same as you gave) */
  headerBack: {
    position: "absolute",
    top: 30,
    left: 16,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    zIndex: 20,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },

  filters: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  filterBtnActive: { backgroundColor: YELLOW, borderColor: YELLOW },
  filterText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  filterTextActive: { color: BTN_TEXT },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  hint: { color: "#B8B0A5", fontWeight: "700", fontSize: 12 },

  card: {
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    marginBottom: 12,
  },

  // ✅ ADDED ONLY: highlight card from QR
  cardHighlight: {
    borderColor: YELLOW,
    borderWidth: 2,
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

  // ✅ Rejection reason block
  rejectBox: {
    marginTop: 10,
    backgroundColor: "#2A0D0D",
    borderWidth: 1,
    borderColor: "#7A2C2C",
    borderRadius: 12,
    padding: 10,
  },
  rejectTitle: {
    color: "#FFD1D1",
    fontWeight: "900",
    marginBottom: 6,
    fontSize: 12,
  },
  rejectText: {
    color: "#FFEBD3",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  divider: { height: 1, backgroundColor: CARD_EDGE, marginVertical: 10 },

  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  rowLabel: { color: "#B8B0A5", fontWeight: "700", fontSize: 12 },
  rowValue: { color: "#EDE7DC", fontWeight: "900", fontSize: 12 },

  sectionTitle: { color: CREAM_INPUT, fontWeight: "900", marginBottom: 8 },

  roomPill: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  roomPillText: { color: "#EDE7DC", fontWeight: "800", fontSize: 12 },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: CREAM_INPUT, fontSize: 13, fontWeight: "900" },
  totalValue: { color: YELLOW, fontSize: 14, fontWeight: "900" },

  payBtn: {
    marginTop: 10,
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  payBtnText: { color: BTN_TEXT, fontWeight: "900" },

  paidBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: PANEL,
  },
  paidText: { color: "#EDE7DC", fontWeight: "900" },

  createdText: {
    marginTop: 10,
    color: "#B8B0A5",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
});
