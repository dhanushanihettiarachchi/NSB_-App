// app/AdminReservations.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  InteractionManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { API_BASE, bookingsApi, paymentsApi } from "../src/services/api";

const TABS = ["Pending", "Approved", "Rejected", "All"];

function safeDate(d: any) {
  if (!d) return "-";
  return String(d).slice(0, 10);
}
function safeTime(t: any) {
  if (!t) return "-";
  // sometimes SQL time comes like "1970-01-01T10:30:00.000Z"
  const s = String(t);
  if (s.includes("T")) return s.split("T")[1]?.slice(0, 5) || "-";
  if (s.length >= 5) return s.slice(0, 5);
  return s;
}
function calcNights(checkIn: any, checkOut: any) {
  try {
    const a = new Date(String(checkIn).slice(0, 10));
    const b = new Date(String(checkOut).slice(0, 10));
    const diff = Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

export default function AdminReservations() {
  const [activeTab, setActiveTab] = useState("Pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [bookings, setBookings] = useState<any[]>([]);

  const [selected, setSelected] = useState<any | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // this will hold either "/uploads/payments/xxx.png" OR full http url
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const admin_id = 1; // TODO: replace with real admin user_id

  const loadBookings = async () => {
    try {
      setLoading(true);
      const res = await bookingsApi.list(activeTab);
      setBookings(res.bookings || []);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load bookings");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      const res = await bookingsApi.list(activeTab);
      setBookings(res.bookings || []);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [activeTab]);

  const openDetails = async (item: any) => {
    setSelected(item);
    // ✅ fastest: from admin list query (OUTER APPLY)
    if (item.payment_slip_path) {
      setPaymentUrl(String(item.payment_slip_path));
    } else {
      setPaymentUrl(null);
    }

    setDetailsVisible(true);

    // fallback: call /payments/booking/:id/latest (in case old data)
    if (!item.payment_slip_path) {
      try {
        const pay = await paymentsApi.latestByBooking(item.booking_id);
        setPaymentUrl(pay?.payment?.proof_url || null);
      } catch {
        setPaymentUrl(null);
      }
    }
  };

  const fullProofUrl = useMemo(() => {
    if (!paymentUrl) return null;
    if (paymentUrl.startsWith("http")) return paymentUrl;
    return `${API_BASE}${paymentUrl}`;
  }, [paymentUrl]);

  const approveBooking = async () => {
    if (!selected) return;
    try {
      await bookingsApi.approve(selected.booking_id, admin_id);
      Alert.alert("Success", "Booking approved");
      setDetailsVisible(false);
      loadBookings();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Approve failed");
    }
  };

  const submitReject = async () => {
    if (!selected) return;

    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert("Required", "Enter rejection reason");
      return;
    }

    try {
      await bookingsApi.reject(selected.booking_id, admin_id, reason);
      Alert.alert("Rejected", "Booking rejected");
      setRejectVisible(false);
      setDetailsVisible(false);
      setRejectReason("");
      loadBookings();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Reject failed");
    }
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetails(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {item.circuit_Name || item.room_Name || "Booking"}
        </Text>

        <View
          style={[
            styles.status,
            item.status === "Pending"
              ? styles.pending
              : item.status === "Approved"
              ? styles.approved
              : styles.rejected,
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.subText}>
        Booking ID: {item.booking_id} | {item.user_name ? `User: ${item.user_name}` : `User ID: ${item.user_id}`}
      </Text>

      <Text style={styles.subText}>
        {item.city || ""} {item.street || ""}
      </Text>

      <Text style={styles.subText}>
        {safeDate(item.check_in_date)} → {safeDate(item.check_out_date)}
      </Text>

      <Text style={styles.subText}>
        Guests: {item.guest_count} | Rooms: {item.need_room_count}
      </Text>

      <Text style={styles.queueText}>
        Queue Time: {String(item.created_date || "").slice(0, 19).replace("T", " ")}
      </Text>
    </TouchableOpacity>
  );

  const nights = selected ? calcNights(selected.check_in_date, selected.check_out_date) : 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>All Reservations</Text>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(i) => String(i.booking_id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={{ color: "#B8C4E6", textAlign: "center", marginTop: 40 }}>
              No reservations found
            </Text>
          }
        />
      )}

      {/* DETAILS MODAL */}
      <Modal visible={detailsVisible} animationType="slide" transparent={false}>
        <View style={styles.modal}>
          <TouchableOpacity onPress={() => setDetailsVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {selected && (
            <>
              <Text style={styles.modalTitle}>
                {selected.circuit_Name || selected.room_Name || "Booking"}
              </Text>

              <Text style={styles.modalText}>Booking ID: {selected.booking_id}</Text>
              <Text style={styles.modalText}>User: {selected.user_name || `User ID ${selected.user_id}`}</Text>

              <Text style={styles.modalText}>Check-in: {safeDate(selected.check_in_date)}</Text>
              <Text style={styles.modalText}>Check-out: {safeDate(selected.check_out_date)}</Text>
              <Text style={styles.modalText}>Time: {safeTime(selected.booking_time)}</Text>

              <Text style={styles.modalText}>Guests: {selected.guest_count}</Text>
              <Text style={styles.modalText}>Rooms: {selected.need_room_count}</Text>
              <Text style={styles.modalText}>Nights: {nights}</Text>

              <Text style={styles.modalText}>
                Estimated Total: Rs {Number(selected.estimated_total || 0).toFixed(2)}
              </Text>

              <Text style={styles.modalText}>Purpose: {selected.purpose || "-"}</Text>
              <Text style={styles.modalText}>Status: {selected.status}</Text>

              <TouchableOpacity
                style={styles.viewSlip}
                onPress={() => {
                  if (!fullProofUrl) {
                    Alert.alert("No payment proof uploaded");
                    return;
                  }

                  // ✅ close modal first, then navigate (prevents "close first then show" bug)
                  setRejectVisible(false);
                  setDetailsVisible(false);

                  InteractionManager.runAfterInteractions(() => {
                    router.push({
                      pathname: "/PaymentProofViewer",
                      params: { url: fullProofUrl },
                    });
                  });
                }}
              >
                <Text style={styles.viewSlipText}>View Payment Proof</Text>
              </TouchableOpacity>

              {selected.status === "Pending" && (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.approve} onPress={approveBooking}>
                    <Text style={styles.actionTextDark}>Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.reject} onPress={() => setRejectVisible(true)}>
                    <Text style={styles.actionTextLight}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Reject modal */}
          <Modal visible={rejectVisible} transparent animationType="fade">
            <View style={styles.rejectOverlay}>
              <View style={styles.rejectBox}>
                <Text style={styles.rejectTitle}>Reject Booking</Text>
                <TextInput
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Reason"
                  placeholderTextColor="#999"
                  style={styles.input}
                />
                <TouchableOpacity style={styles.submitReject} onPress={submitReject}>
                  <Text style={{ fontWeight: "700" }}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#00113D", padding: 16 },
  back: { marginTop: 40 },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginVertical: 16,
  },

  tabs: { flexDirection: "row", justifyContent: "space-between" },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2A3A74",
    margin: 4,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#FFB600" },
  tabText: { color: "#fff", fontSize: 12 },
  tabTextActive: { color: "#00113D", fontWeight: "700" },

  card: {
    backgroundColor: "#071642",
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { color: "#fff", fontWeight: "800" },
  subText: { color: "#B8C4E6", marginTop: 4 },
  queueText: { color: "#8EA2D9", marginTop: 8, fontSize: 12 },

  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: "800" },
  pending: { backgroundColor: "#FFB600" },
  approved: { backgroundColor: "#5CFFB0" },
  rejected: { backgroundColor: "#FF5C5C" },

  modal: { flex: 1, backgroundColor: "#00113D", padding: 16 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 16 },
  modalText: { color: "#B8C4E6", marginTop: 8 },

  viewSlip: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFB600",
  },
  viewSlipText: { color: "#FFB600", textAlign: "center", fontWeight: "700" },

  actions: { flexDirection: "row", marginTop: 20, gap: 10 },
  approve: {
    flex: 1,
    backgroundColor: "#FFB600",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  reject: {
    flex: 1,
    backgroundColor: "#FF3B3B",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  actionTextDark: { color: "#00113D", fontWeight: "800" },
  actionTextLight: { color: "#fff", fontWeight: "800" },

  rejectOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  rejectBox: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
  },
  rejectTitle: { fontWeight: "800", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
  },
  submitReject: {
    backgroundColor: "#FFB600",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
  },
});
