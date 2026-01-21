// AdminReservations.tsx
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
  Pressable,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { bookingsApi, paymentsApi } from "../src/services/api";
import { API_URL } from "../src/services/config";

const TABS = ["Pending", "Approved", "Rejected", "All"];

const NAVY = "#020038";
const YELLOW = "#FFB600";

// ✅ Keep this BLUE for Payment Uploaded
const BLUE = "#4DA3FF";

// ✅ NEW: Only for "Payment NOT Uploaded" pill (does NOT affect buttons/tabs)
const PAYMENT_NOT_UPLOADED = "#ed9bab";

const MUTED = "rgba(255,255,255,0.70)";
const MUTED2 = "rgba(255,255,255,0.45)";
const CARD_BG = "rgba(10,10,26,0.88)";

function safeDate(d: any) {
  if (!d) return "-";
  return String(d).slice(0, 10);
}
function safeTime(t: any) {
  if (!t) return "-";
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

  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const admin_id = 1;

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
    if (item.payment_slip_path) {
      setPaymentUrl(String(item.payment_slip_path));
    } else {
      setPaymentUrl(null);
    }

    setDetailsVisible(true);

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
    return `${API_URL}${paymentUrl}`;
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

  const renderItem = ({ item }: any) => {
    const hasPayment = item.has_payment_proof === 1 || !!item.payment_slip_path;

    const statusStyle =
      item.status === "Pending"
        ? styles.statusPending
        : item.status === "Approved"
        ? styles.statusApproved
        : styles.statusRejected;

    const statusIcon =
      item.status === "Pending"
        ? "time-outline"
        : item.status === "Approved"
        ? "checkmark-circle-outline"
        : "close-circle-outline";

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.95, transform: [{ scale: 0.995 }] },
        ]}
        onPress={() => openDetails(item)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.circuit_Name || item.room_Name || "Booking"}
            </Text>
            <Text style={styles.subText} numberOfLines={1}>
              Booking ID: {item.booking_id}{" "}
              {item.user_name ? `| User: ${item.user_name}` : `| User ID: ${item.user_id}`}
            </Text>
          </View>

          <View style={[styles.statusPill, statusStyle]}>
            <Ionicons
              name={statusIcon as any}
              size={14}
              color={item.status === "Pending" ? NAVY : "#fff"}
            />
            <Text
              style={[
                styles.statusText,
                item.status === "Pending" ? { color: NAVY } : { color: "#fff" },
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>

        {/* ✅ PAYMENT STATUS (ONLY FOR PENDING) */}
        {item.status === "Pending" && (
          <View
            style={[
              styles.paymentPill,
              {
                // ✅ Uploaded stays BLUE, Not Uploaded uses NEW color (not YELLOW)
                backgroundColor: hasPayment ? BLUE : PAYMENT_NOT_UPLOADED,
              },
            ]}
          >
            <Ionicons
              name={hasPayment ? "checkmark-circle-outline" : "alert-circle-outline"}
              size={14}
              color={NAVY}
            />
            <Text style={styles.paymentText}>
              {hasPayment ? "Payment Uploaded" : "Payment NOT Uploaded"}
            </Text>
          </View>
        )}

        <View style={styles.rowLine}>
          <Ionicons name="location-outline" size={16} color={YELLOW} />
          <Text style={styles.rowText}>
            {item.city || ""} {item.street || ""}
          </Text>
        </View>

        <View style={styles.rowLine}>
          <Ionicons name="calendar-outline" size={16} color={YELLOW} />
          <Text style={styles.rowText}>
            {safeDate(item.check_in_date)} → {safeDate(item.check_out_date)}
          </Text>
        </View>

        <View style={styles.rowLine}>
          <Ionicons name="people-outline" size={16} color={YELLOW} />
          <Text style={styles.rowText}>
            Guests: {item.guest_count} • Rooms: {item.need_room_count}
          </Text>
        </View>

        <Text style={styles.queueText}>
          Queue Time: {String(item.created_date || "").slice(0, 19).replace("T", " ")}
        </Text>
      </Pressable>
    );
  };

  const nights = selected ? calcNights(selected.check_in_date, selected.check_out_date) : 0;

  return (
    <LinearGradient colors={["#020038", "#05004A", "#020038"]} style={styles.background}>
      <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.9}>
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>All Reservations</Text>
        <Text style={styles.subtitle}>Review pending payments & booking requests</Text>
      </View>

      <View style={styles.tabsWrap}>
        <View style={styles.tabsCard}>
          {TABS.map((t) => {
            const active = activeTab === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(t)}
                activeOpacity={0.9}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={YELLOW} size="large" />
          <Text style={styles.loadingText}>Loading reservations...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={bookings}
          keyExtractor={(i) => String(i.booking_id)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No reservations found</Text>}
        />
      )}

      {/* DETAILS MODAL */}
      <Modal visible={detailsVisible} animationType="slide" transparent={false}>
        <LinearGradient colors={["#020038", "#05004A", "#020038"]} style={styles.modalBg}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setDetailsVisible(false)}
            activeOpacity={0.9}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {selected && (
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selected.circuit_Name || selected.room_Name || "Booking"}
                </Text>

                <View style={styles.modalDivider} />

                <InfoRow icon="key-outline" label="Booking ID" value={String(selected.booking_id)} />
                <InfoRow icon="person-outline" label="User" value={selected.user_name || `User ID ${selected.user_id}`} />
                <InfoRow icon="calendar-outline" label="Check-in" value={safeDate(selected.check_in_date)} />
                <InfoRow icon="calendar-outline" label="Check-out" value={safeDate(selected.check_out_date)} />
                <InfoRow icon="time-outline" label="Time" value={safeTime(selected.booking_time)} />
                <InfoRow icon="people-outline" label="Guests" value={String(selected.guest_count)} />
                <InfoRow icon="home-outline" label="Rooms" value={String(selected.need_room_count)} />
                <InfoRow icon="moon-outline" label="Nights" value={String(nights)} />
                <InfoRow
                  icon="cash-outline"
                  label="Estimated Total"
                  value={`Rs ${Number(selected.estimated_total || 0).toFixed(2)}`}
                />
                <InfoRow icon="information-circle-outline" label="Purpose" value={selected.purpose || "-"} />
                <InfoRow icon="shield-checkmark-outline" label="Status" value={selected.status} />

                <TouchableOpacity
                  style={styles.viewSlipBtn}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (!fullProofUrl) {
                      Alert.alert("No payment proof uploaded");
                      return;
                    }

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
                  <Ionicons name="document-text-outline" size={18} color={YELLOW} />
                  <Text style={styles.viewSlipText}>View Payment Proof</Text>
                </TouchableOpacity>

                {selected.status === "Pending" && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.approveBtn} onPress={approveBooking} activeOpacity={0.9}>
                      <Text style={styles.approveText}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.rejectBtn} onPress={() => setRejectVisible(true)} activeOpacity={0.9}>
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          <Modal visible={rejectVisible} transparent animationType="fade">
            <View style={styles.rejectOverlay}>
              <View style={styles.rejectCard}>
                <View style={styles.rejectTop}>
                  <Text style={styles.rejectTitle}>Reject Booking</Text>
                  <TouchableOpacity onPress={() => setRejectVisible(false)} style={styles.rejectClose} activeOpacity={0.9}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.rejectHint}>Please enter the reason for rejection.</Text>

                <View style={styles.inputWrap}>
                  <Ionicons name="alert-circle-outline" size={18} color={MUTED} />
                  <TextInput
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    placeholder="Reason"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    style={styles.rejectInput}
                    multiline
                  />
                </View>

                <TouchableOpacity style={styles.submitReject} onPress={submitReject} activeOpacity={0.9}>
                  <Text style={styles.submitRejectText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={YELLOW} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },

  headerBack: {
    position: "absolute",
    top: 30,
    left: 16,
    zIndex: 20,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  header: {
    position: "absolute",
    top: 78,
    left: 0,
    right: 0,
    zIndex: 15,
    alignItems: "center",
    paddingHorizontal: "7%",
  },

  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },

  tabsWrap: {
    paddingHorizontal: "7%",
    paddingTop: 130,
  },

  tabsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 10,
    flexDirection: "row",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },

  tab: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  tabActive: {
    backgroundColor: YELLOW,
    borderColor: "rgba(255,182,0,0.35)",
  },

  tabText: { color: "rgba(255,255,255,0.80)", fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: NAVY },

  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: "7%" },
  loadingText: { color: "#fff", marginTop: 10, fontWeight: "700" },

  list: { flex: 1, backgroundColor: "transparent" },
  listContent: {
    paddingHorizontal: "7%",
    paddingTop: 14,
    paddingBottom: 18,
  },

  emptyText: { color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: 40, fontWeight: "800" },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    marginTop: 12,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },

  subText: { color: "rgba(255,255,255,0.72)", marginTop: 6, fontWeight: "700", fontSize: 12 },

  rowLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  rowText: { color: "rgba(255,255,255,0.78)", fontWeight: "800", fontSize: 12 },

  queueText: { color: MUTED2, marginTop: 10, fontSize: 11, fontWeight: "800" },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: "900" },

  paymentPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  paymentText: {
    fontSize: 11,
    fontWeight: "900",
    color: NAVY,
  },

  statusPending: { backgroundColor: YELLOW },
  statusApproved: { backgroundColor: "rgba(92,255,176,0.30)", borderWidth: 1, borderColor: "rgba(92,255,176,0.35)" },
  statusRejected: { backgroundColor: "rgba(255,92,92,0.25)", borderWidth: 1, borderColor: "rgba(255,92,92,0.35)" },

  modalBg: { flex: 1 },

  modalClose: {
    position: "absolute",
    top: 30,
    right: 16,
    zIndex: 30,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  modalContent: {
    flexGrow: 1,
    paddingHorizontal: "7%",
    paddingTop: 90,
    paddingBottom: 30,
  },

  modalCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },

  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "center" },

  modalDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.10)", marginVertical: 16 },

  infoRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 10 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(255,182,0,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,182,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { color: MUTED, fontWeight: "800", fontSize: 12 },
  infoValue: { color: "#fff", fontWeight: "900", fontSize: 13, marginTop: 2 },

  viewSlipBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,182,0,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,182,0,0.30)",
  },
  viewSlipText: { color: YELLOW, fontWeight: "900" },

  actions: { flexDirection: "row", gap: 12, marginTop: 16 },

  approveBtn: {
    flex: 1,
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  approveText: { color: NAVY, fontWeight: "900" },

  rejectBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,120,120,0.30)",
    backgroundColor: "rgba(255,90,90,0.18)",
    paddingVertical: 14,
    alignItems: "center",
  },
  rejectText: { color: "#FFB3B3", fontWeight: "900" },

  rejectOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.60)",
    justifyContent: "center",
    padding: 20,
  },

  rejectCard: {
    backgroundColor: "rgba(10,10,26,0.98)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  rejectTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rejectTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  rejectClose: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  rejectHint: { marginTop: 10, color: MUTED, fontWeight: "700", fontSize: 12 },

  inputWrap: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  rejectInput: { flex: 1, color: "#fff", fontSize: 14, minHeight: 70 },

  submitReject: {
    marginTop: 12,
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitRejectText: { color: NAVY, fontWeight: "900", fontSize: 14 },
});
