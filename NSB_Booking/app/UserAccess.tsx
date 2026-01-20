import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';

const NAVY = '#020038';
const YELLOW = '#FFB600';
const MUTED = 'rgba(255,255,255,0.70)';

type User = {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
};

type Role = {
  role_id: number;
  role_name: string;
  description?: string;
};

export default function UserAccessScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<{ [key: number]: number }>({});
  const [searchText, setSearchText] = useState('');

  // TODO: later get from logged-in user
  const superAdminId = 1;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersRes, rolesRes] = await Promise.all([
          fetch(`${API_URL}/admin/users`),
          fetch(`${API_URL}/admin/roles`),
        ]);

        const usersData = await usersRes.json();
        const rolesData = await rolesRes.json();

        setUsers(usersData.users || []);
        setRoles(rolesData.roles || []);

        const initial: { [key: number]: number } = {};
        (usersData.users || []).forEach((u: User) => {
          const match = (rolesData.roles || []).find((r: Role) => r.role_name === u.role);
          if (match) initial[u.user_id] = match.role_id;
        });
        setSelectedRoles(initial);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load users/roles');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleChangeRole = (userId: number, roleId: number) => {
    setSelectedRoles((prev) => ({
      ...prev,
      [userId]: roleId,
    }));
  };

  const handleSave = async (user: User) => {
    const roleId = selectedRoles[user.user_id];
    if (!roleId) {
      Alert.alert('Select role', 'Please select a role first.');
      return;
    }

    try {
      setSavingUserId(user.user_id);

      const res = await fetch(`${API_URL}/admin/assign-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          role_id: roleId,
          assigned_by: superAdminId,
          circuit_id: null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data.message || 'Failed to assign role');
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, role: data.user.role } : u))
      );

      Alert.alert('Success', 'Role updated successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to assign role');
    } finally {
      setSavingUserId(null);
    }
  };

  const rolesById = useMemo(() => {
    const map = new Map<number, Role>();
    roles.forEach((r) => map.set(r.role_id, r));
    return map;
  }, [roles]);

  const renderItem = ({ item }: { item: User }) => {
    const selectedRoleId = selectedRoles[item.user_id] ?? 0;

    return (
      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Text style={styles.nameText}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={styles.emailText}>{item.email}</Text>
          <Text style={styles.roleText}>Current: {item.role}</Text>
        </View>

        <View style={{ flex: 2 }}>
          <RolePicker
            value={selectedRoleId}
            roles={roles}
            roleLabel={rolesById.get(selectedRoleId)?.role_name ?? 'Select role'}
            onChange={(val) => handleChangeRole(item.user_id, val)}
          />
        </View>

        <TouchableOpacity
          style={styles.assignButton}
          onPress={() => handleSave(item)}
          disabled={savingUserId === item.user_id}
          activeOpacity={0.9}
        >
          {savingUserId === item.user_id ? (
            <ActivityIndicator color={NAVY} />
          ) : (
            <Text style={styles.assignButtonText}>Update</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </LinearGradient>
    );
  }

  const filteredUsers = users.filter((u) => {
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    return fullName.includes(searchText.trim().toLowerCase());
  });

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      <View style={styles.container}>
        {/* Back button (Admin style) */}
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => router.replace('/AdminDashboard')}
          activeOpacity={0.9}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>User Access Management</Text>

        <View style={styles.card}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={MUTED} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name"
              placeholderTextColor={MUTED}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {users.length === 0 ? (
            <Text style={styles.emptyText}>No users found.</Text>
          ) : filteredUsers.length === 0 && searchText ? (
            <Text style={styles.emptyText}>No users match "{searchText}".</Text>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.user_id.toString()}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

/**
 * ✅ iOS FIX:
 * - Android: normal Picker
 * - iOS: show selected role as a button; open modal picker when pressed
 * (Logic stays the same; only UI changes to make role names visible.)
 */
function RolePicker({
  value,
  roles,
  roleLabel,
  onChange,
}: {
  value: number;
  roles: Role[];
  roleLabel: string;
  onChange: (val: number) => void;
}) {
  const [open, setOpen] = useState(false);

  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={value}
          onValueChange={(val) => onChange(val)}
          style={styles.pickerAndroid}
          dropdownIconColor="#FFFFFF"
        >
          <Picker.Item label="Select role" value={0} />
          {roles.map((role) => (
            <Picker.Item key={role.role_id} label={role.role_name} value={role.role_id} />
          ))}
        </Picker>
      </View>
    );
  }

  // iOS: Button + Modal wheel
  return (
    <>
      <TouchableOpacity
        style={styles.iosRoleButton}
        onPress={() => setOpen(true)}
        activeOpacity={0.9}
      >
        <Text style={styles.iosRoleButtonText} numberOfLines={2}>
          {roleLabel || 'Select role'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>Select role</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.modalDone} activeOpacity={0.9}>
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalPickerWrap}>
              <Picker selectedValue={value} onValueChange={(val) => onChange(val)} style={styles.pickerIOS}>
                <Picker.Item label="Select role" value={0} />
                {roles.map((role) => (
                  <Picker.Item key={role.role_id} label={role.role_name} value={role.role_id} />
                ))}
              </Picker>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },

  container: {
    flex: 1,
    paddingHorizontal: '6%',
    paddingTop: 60,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 14,
  },

  card: {
    flex: 1,
    backgroundColor: 'rgba(10,10,26,0.88)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },

  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  emptyText: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '700',
  },

  row: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  nameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },

  emailText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },

  roleText: {
    color: YELLOW,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
  },

  assignButton: {
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    marginLeft: 8,
  },

  assignButtonText: {
    color: NAVY,
    fontWeight: '900',
    fontSize: 12,
  },

  /* ANDROID PICKER WRAP */
  pickerWrap: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    marginHorizontal: 6,
  },

  pickerAndroid: {
    height: 44,
    color: '#FFFFFF',
  },

  /* iOS role button (shows FULL role name) */
  iosRoleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginHorizontal: 6,
  },

  iosRoleButtonText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  /* iOS modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },

  modalSheet: {
    backgroundColor: 'rgba(10,10,26,0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingBottom: 10,
  },

  modalTop: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },

  modalTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  modalDone: {
    backgroundColor: YELLOW,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },

  modalDoneText: {
    color: NAVY,
    fontWeight: '900',
    fontSize: 12,
  },

  modalPickerWrap: {
    paddingHorizontal: 6,
  },

  pickerIOS: {
    color: '#FFFFFF',
  },
});
