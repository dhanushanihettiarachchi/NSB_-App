// NSB_Booking/app/UserDashboard.tsx
// app/UserDashboard.tsx
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const NAVY = '#020038'; // match sign in / sign up
const YELLOW = '#FFB600';
const CARD = '#0A0A1A';
const MUTED = 'rgba(255,255,255,0.70)';
const MUTED2 = 'rgba(255,255,255,0.45)';

const SCREEN_W = Dimensions.get('window').width;
const DRAWER_W = Math.min(320, SCREEN_W * 0.82);

export default function UserDashboard() {
  const params = useLocalSearchParams();

  const userId = String(params.userId ?? '');
  const firstName = String(params.firstName ?? '');
  const lastName = String(params.lastName ?? '');
  const email = String(params.email ?? '');
  const role = String(params.role ?? 'EndUser');

  const fullName = useMemo(() => {
    const n = `${firstName} ${lastName}`.trim();
    return n.length ? n : 'User';
  }, [firstName, lastName]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slide = useRef(new Animated.Value(DRAWER_W)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(slide, {
      toValue: DRAWER_W,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setDrawerOpen(false));
  };

  const logout = () => router.replace('/SignIn');

  const goToBungalows = () => router.push({ pathname: '/UserBungalows', params: { userId } });
  const goToBookings = () => router.push({ pathname: '/UserBookings', params: { userId } });

  // Hover/press highlight states (only for icon background)
  const [hoveredIcon, setHoveredIcon] = useState<'bungalows' | 'bookings' | null>(null);

  const isIconActive = (key: 'bungalows' | 'bookings', pressed: boolean) =>
    pressed || hoveredIcon === key;

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          {/* ✅ ONLY HEADER POSITION CHANGED */}

          {/* Back Icon (top-left) */}
          <TouchableOpacity style={styles.headerBack} onPress={logout} activeOpacity={0.9}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Profile Icon (top-right) */}
          <TouchableOpacity style={styles.headerProfile} onPress={openDrawer} activeOpacity={0.9}>
            <Ionicons name="person-circle-outline" size={30} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Main card (Sign-in style) */}
          <View style={styles.mainWrap}>
            <View style={styles.card}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.name}>{fullName}!</Text>
              <Text style={styles.subtitle}>Choose an option to continue</Text>

              <View style={styles.divider} />

              {/* View Available Bungalows */}
              <Pressable
                style={styles.actionRow}
                onPress={goToBungalows}
                onHoverIn={() => setHoveredIcon('bungalows')}
                onHoverOut={() => setHoveredIcon((p) => (p === 'bungalows' ? null : p))}
              >
                {({ pressed }) => {
                  const active = isIconActive('bungalows', pressed);
                  return (
                    <>
                      <View style={active ? styles.iconYellow : styles.iconOutline}>
                        <Ionicons name="home-outline" size={20} color={active ? NAVY : YELLOW} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.actionTitle}>View Available Bungalows</Text>
                        <Text style={styles.actionSub}>Check availability & details</Text>
                      </View>

                      <View style={styles.chevPill}>
                        <Ionicons name="chevron-forward" size={18} color={YELLOW} />
                      </View>
                    </>
                  );
                }}
              </Pressable>

              {/* My Bookings */}
              <Pressable
                style={styles.actionRow}
                onPress={goToBookings}
                onHoverIn={() => setHoveredIcon('bookings')}
                onHoverOut={() => setHoveredIcon((p) => (p === 'bookings' ? null : p))}
              >
                {({ pressed }) => {
                  const active = isIconActive('bookings', pressed);
                  return (
                    <>
                      <View style={active ? styles.iconYellow : styles.iconOutline}>
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color={active ? NAVY : YELLOW}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.actionTitle}>My Bookings</Text>
                        <Text style={styles.actionSub}>Pending / Approved / Rejected</Text>
                      </View>

                      <View style={styles.chevPill}>
                        <Ionicons name="chevron-forward" size={18} color={YELLOW} />
                      </View>
                    </>
                  );
                }}
              </Pressable>
            </View>
          </View>

          {/* Bottom nav (dark, matching card) */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.navBtn} onPress={goToBungalows} activeOpacity={0.9}>
              <View style={styles.navIconWrap}>
                <Ionicons name="home-outline" size={22} color={YELLOW} />
              </View>
              <Text style={styles.navLabel}>Bungalows</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navBtnCenter} onPress={goToBookings} activeOpacity={0.9}>
              <View style={styles.centerFab}>
                <Ionicons name="add" size={28} color={NAVY} />
              </View>
              <Text style={styles.navLabel}>Bookings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navBtn} onPress={openDrawer} activeOpacity={0.9}>
              <View style={styles.navIconWrap}>
                <Ionicons name="person-outline" size={22} color={YELLOW} />
              </View>
              <Text style={styles.navLabel}>Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Drawer (dark theme) */}
          <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={closeDrawer}>
            <Pressable style={drawerStyles.overlay} onPress={closeDrawer}>
              <Animated.View
                style={[drawerStyles.drawer, { transform: [{ translateX: slide }] }]}
                onStartShouldSetResponder={() => true}
              >
                <View style={drawerStyles.top}>
                  <Text style={drawerStyles.title}>Profile</Text>
                  <TouchableOpacity
                    onPress={closeDrawer}
                    style={drawerStyles.closeBtn}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={drawerStyles.profileHead}>
                  <View style={drawerStyles.avatar}>
                    <Text style={drawerStyles.avatarText}>
                      {(firstName?.[0] || fullName?.[0] || 'U').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={drawerStyles.name}>{fullName}</Text>
                    <Text style={drawerStyles.sub}>{role}</Text>
                  </View>
                </View>

                <View style={drawerStyles.divider} />

                <InfoRow icon="id-card-outline" label="User ID" value={userId || '-'} />
                <InfoRow icon="mail-outline" label="Email" value={email || '-'} />
                <InfoRow icon="shield-checkmark-outline" label="Role" value={role || '-'} />

                <TouchableOpacity style={drawerStyles.logoutBtn} onPress={logout} activeOpacity={0.9}>
                  <Ionicons name="log-out-outline" size={18} color={NAVY} />
                  <Text style={drawerStyles.logoutText}>Logout</Text>
                </TouchableOpacity>
              </Animated.View>
            </Pressable>
          </Modal>
        </View>
      </SafeAreaView>
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
    <View style={drawerStyles.infoRow}>
      <View style={drawerStyles.infoIcon}>
        <Ionicons name={icon} size={18} color={YELLOW} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={drawerStyles.infoLabel}>{label}</Text>
        <Text style={drawerStyles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  background: { flex: 1 },
  safe: { flex: 1 },
  container: { flex: 1 },

  // (kept, not used now)
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ✅ Back icon style (your provided style) */
  headerBack: {
    position: 'absolute',
    top: 30,
    left: 16,
    zIndex: 10,
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  /* ✅ NEW: Profile icon forced to top-right (same look as headerBtn) */
  headerProfile: {
    position: 'absolute',
    top: 30,
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mainWrap: {
    flex: 1,
    paddingHorizontal: '7%',
    paddingTop: 90,
  },

  card: {
    backgroundColor: 'rgba(10,10,26,0.88)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },

  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 10,
  },
  subtitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: 16,
  },

  actionRow: {
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 12,
  },

  iconYellow: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOutline: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.65)',
    backgroundColor: 'rgba(255,182,0,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  actionSub: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  chevPill: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: 'rgba(255,182,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    height: 78,
    backgroundColor: 'rgba(10,10,26,0.92)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },

  navBtn: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  navBtnCenter: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -24,
  },

  navIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  centerFab: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },

  navLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.80)',
  },
});

/* ================= DRAWER STYLES ================= */

const drawerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  drawer: {
    width: DRAWER_W,
    height: '100%',
    backgroundColor: 'rgba(10,10,26,0.98)',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingTop: 18,
    paddingHorizontal: 14,
  },

  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileHead: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: { color: NAVY, fontWeight: '900', fontSize: 18 },
  name: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  sub: { marginTop: 2, fontSize: 12, fontWeight: '800', color: MUTED },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 14 },

  infoRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },

  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoLabel: { color: MUTED2, fontWeight: '800', fontSize: 12 },
  infoValue: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, marginTop: 2 },

  logoutBtn: {
    marginTop: 14,
    backgroundColor: YELLOW,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutText: { color: NAVY, fontWeight: '900' },
});
