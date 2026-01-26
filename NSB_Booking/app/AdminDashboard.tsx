// app/AdminDashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

const NAVY = '#020038';
const YELLOW = '#FFB600';
const MUTED = 'rgba(255,255,255,0.70)';
const MUTED2 = 'rgba(255,255,255,0.45)';

const SCREEN_W = Dimensions.get('window').width;
const DRAWER_W = Math.min(320, SCREEN_W * 0.82);

export default function AdminDashboard() {
  const params = useLocalSearchParams();

  // ✅ local state (can be filled from params OR AsyncStorage)
  const [adminIdState, setAdminIdState] = useState('');
  const [firstNameState, setFirstNameState] = useState('');
  const [lastNameState, setLastNameState] = useState('');
  const [emailState, setEmailState] = useState('');
  const [roleState, setRoleState] = useState('SuperAdmin');

  // ✅ read params first (when available)
  useEffect(() => {
    const pAdminId = String(params.adminId ?? params.userId ?? '');
    const pFirst = String(params.firstName ?? '');
    const pLast = String(params.lastName ?? '');
    const pEmail = String(params.email ?? '');
    const pRole = String(params.role ?? 'SuperAdmin');

    // if params have values, use them
    if (pAdminId || pEmail || pFirst || pLast) {
      setAdminIdState(pAdminId);
      setFirstNameState(pFirst);
      setLastNameState(pLast);
      setEmailState(pEmail);
      setRoleState(pRole);
      return;
    }

    // otherwise load from AsyncStorage (when navigated without params)
    (async () => {
      const [uid, em, fn, ln, rl] = await Promise.all([
        AsyncStorage.getItem('user_id'),
        AsyncStorage.getItem('email'),
        AsyncStorage.getItem('first_name'),
        AsyncStorage.getItem('last_name'),
        AsyncStorage.getItem('role'),
      ]);

      setAdminIdState(uid ? String(uid) : '');
      setEmailState(em ? String(em) : '');
      setFirstNameState(fn ? String(fn) : '');
      setLastNameState(ln ? String(ln) : '');
      setRoleState(rl ? String(rl) : 'SuperAdmin');
    })();
  }, [params.adminId, params.userId, params.firstName, params.lastName, params.email, params.role]);

  const adminId = adminIdState;
  const firstName = firstNameState;
  const lastName = lastNameState;
  const email = emailState;
  const role = roleState;

  const fullName = useMemo(() => {
    const n = `${firstName} ${lastName}`.trim();
    return n.length ? n : 'Super Admin';
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

  const logout = async () => {
    // optional: clear stored login so EditCircuit doesn't use old ID after logout
    await AsyncStorage.multiRemove(['user_id', 'email', 'first_name', 'last_name', 'role']);
    router.replace('/SignIn');
  };

  const goToUserAccess = () => router.push('/UserAccess');
  const goToCircuits = () => router.push('/CircuitManage');
  const goToReservations = () => router.push('/AdminReservations');

  const [hoveredIcon, setHoveredIcon] = useState<'users' | 'circuits' | 'reservations' | null>(null);

  const isIconActive = (key: 'users' | 'circuits' | 'reservations', pressed: boolean) =>
    pressed || hoveredIcon === key;

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.headerBack} onPress={logout} activeOpacity={0.9}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerProfile} onPress={openDrawer} activeOpacity={0.9}>
            <Ionicons name="person-circle-outline" size={30} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.mainWrap}>
            <View style={styles.card}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.name}>{fullName}!</Text>
              <Text style={styles.subtitle}>Super Admin Controls</Text>

              <View style={styles.divider} />

              <Pressable
                style={styles.actionRow}
                onPress={goToUserAccess}
                onHoverIn={() => setHoveredIcon('users')}
                onHoverOut={() => setHoveredIcon((p) => (p === 'users' ? null : p))}
              >
                {({ pressed }) => {
                  const active = isIconActive('users', pressed);
                  return (
                    <>
                      <View style={active ? styles.iconYellow : styles.iconOutline}>
                        <Ionicons name="people-outline" size={20} color={active ? NAVY : YELLOW} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.actionTitle}>Manage User Access</Text>
                        <Text style={styles.actionSub}>Approve / restrict users</Text>
                      </View>

                      <View style={styles.chevPill}>
                        <Ionicons name="chevron-forward" size={18} color={YELLOW} />
                      </View>
                    </>
                  );
                }}
              </Pressable>

              <Pressable
                style={styles.actionRow}
                onPress={goToCircuits}
                onHoverIn={() => setHoveredIcon('circuits')}
                onHoverOut={() => setHoveredIcon((p) => (p === 'circuits' ? null : p))}
              >
                {({ pressed }) => {
                  const active = isIconActive('circuits', pressed);
                  return (
                    <>
                      <View style={active ? styles.iconYellow : styles.iconOutline}>
                        <Ionicons name="home-outline" size={20} color={active ? NAVY : YELLOW} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.actionTitle}>Manage Circuit Bungalows</Text>
                        <Text style={styles.actionSub}>Add / update bungalow details</Text>
                      </View>

                      <View style={styles.chevPill}>
                        <Ionicons name="chevron-forward" size={18} color={YELLOW} />
                      </View>
                    </>
                  );
                }}
              </Pressable>

              <Pressable
                style={styles.actionRow}
                onPress={goToReservations}
                onHoverIn={() => setHoveredIcon('reservations')}
                onHoverOut={() => setHoveredIcon((p) => (p === 'reservations' ? null : p))}
              >
                {({ pressed }) => {
                  const active = isIconActive('reservations', pressed);
                  return (
                    <>
                      <View style={active ? styles.iconYellow : styles.iconOutline}>
                        <Ionicons name="calendar-outline" size={20} color={active ? NAVY : YELLOW} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.actionTitle}>See All Reservations</Text>
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

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.navBtn} onPress={goToUserAccess} activeOpacity={0.9}>
              <View style={styles.navIconWrap}>
                <Ionicons name="people-outline" size={22} color={YELLOW} />
              </View>
              <Text style={styles.navLabel}>User Access</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navBtnCenter} onPress={goToCircuits} activeOpacity={0.9}>
              <View style={styles.centerFab}>
                <Ionicons name="home" size={26} color={NAVY} />
              </View>
              <Text style={styles.navLabel}>Circuits</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navBtn} onPress={goToReservations} activeOpacity={0.9}>
              <View style={styles.navIconWrap}>
                <Ionicons name="calendar-outline" size={22} color={YELLOW} />
              </View>
              <Text style={styles.navLabel}>Reservations</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={closeDrawer}>
            <Pressable style={drawerStyles.overlay} onPress={closeDrawer}>
              <Animated.View
                style={[drawerStyles.drawer, { transform: [{ translateX: slide }] }]}
                onStartShouldSetResponder={() => true}
              >
                <View style={drawerStyles.top}>
                  <Text style={drawerStyles.title}>Profile</Text>
                  <TouchableOpacity onPress={closeDrawer} style={drawerStyles.closeBtn} activeOpacity={0.9}>
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={drawerStyles.profileHead}>
                  <View style={drawerStyles.avatar}>
                    <Text style={drawerStyles.avatarText}>
                      {(firstName?.[0] || fullName?.[0] || 'S').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={drawerStyles.name}>{fullName}</Text>
                    <Text style={drawerStyles.sub}>{role}</Text>
                  </View>
                </View>

                <View style={drawerStyles.divider} />

                <InfoRow icon="id-card-outline" label="Admin ID" value={adminId || '-'} />
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

// ✅ styles unchanged below...
const styles = StyleSheet.create({
  background: { flex: 1 },
  safe: { flex: 1 },
  container: { flex: 1 },
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
  mainWrap: { flex: 1, paddingHorizontal: '7%', paddingTop: 90 },
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
  title: { color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  name: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  subtitle: { color: MUTED, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 16 },
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
  iconYellow: { width: 44, height: 44, borderRadius: 16, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
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
  actionSub: { color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '700', marginTop: 4 },
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
  navBtn: { width: 100, alignItems: 'center', justifyContent: 'center', gap: 6 },
  navBtnCenter: { width: 100, alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -24 },
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
  centerFab: { width: 58, height: 58, borderRadius: 22, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  navLabel: { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.80)', textAlign: 'center' },
});

const drawerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'flex-end' },
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
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  profileHead: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: NAVY, fontWeight: '900', fontSize: 18 },
  name: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  sub: { marginTop: 2, fontSize: 12, fontWeight: '800', color: MUTED },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 14 },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10 },
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
