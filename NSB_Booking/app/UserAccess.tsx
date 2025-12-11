import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,             // 👈 add this
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const NAVY = '#020038';
const YELLOW = '#FFB600';
const CREAM = '#FFEBD3';
const BLACK_BOX = '#050515';

const API_URL =
  Platform.OS === 'web'
    ? 'http://localhost:3001'
    : 'http://192.168.8.109:3001';

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
  const [searchText, setSearchText] = useState('');   // 👈 search text

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
          const match = (rolesData.roles || []).find(
            (r: Role) => r.role_name === u.role
          );
          if (match) {
            initial[u.user_id] = match.role_id;
          }
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
    setSelectedRoles(prev => ({
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

      setUsers(prev =>
        prev.map(u => (u.user_id === user.user_id ? { ...u, role: data.user.role } : u))
      );

      Alert.alert('Success', 'Role updated successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to assign role');
    } finally {
      setSavingUserId(null);
    }
  };

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.row}>
      <View style={{ flex: 2 }}>
        <Text style={styles.nameText}>{item.first_name} {item.last_name}</Text>
        <Text style={styles.emailText}>{item.email}</Text>
        <Text style={styles.roleText}>Current: {item.role}</Text>
      </View>

      <View style={{ flex: 2 }}>
        <Picker
          selectedValue={selectedRoles[item.user_id]}
          onValueChange={(value) => handleChangeRole(item.user_id, value)}
          style={styles.picker}
          dropdownIconColor="#000"
        >
          <Picker.Item label="Select role" value={0} />
          {roles.map(role => (
            <Picker.Item
              key={role.role_id}
              label={role.role_name}
              value={role.role_id}
            />
          ))}
        </Picker>
      </View>

      <TouchableOpacity
        style={styles.assignButton}
        onPress={() => handleSave(item)}
        disabled={savingUserId === item.user_id}
      >
        {savingUserId === item.user_id ? (
          <ActivityIndicator color="#00113D" />
        ) : (
          <Text style={styles.assignButtonText}>Update</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 👇 filter users by name (first + last)
  const filteredUsers = users.filter(u => {
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    return fullName.includes(searchText.trim().toLowerCase());
  });

  return (
    <View style={styles.screen}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace('/AdminDashboard')}
      >
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Title */}
      <Text style={styles.title}>User Access Management</Text>

      {/* Card wrapper */}
      <View style={styles.card}>

        {/* 🔍 Search bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#B0A9A0" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name"
            placeholderTextColor="#B0A9A0"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {users.length === 0 ? (
          <Text style={styles.emptyText}>
            No users found.
          </Text>
        ) : filteredUsers.length === 0 && searchText ? (
          <Text style={styles.emptyText}>
            No users match "{searchText}".
          </Text>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.user_id.toString()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )}
      </View>

      {/* Footer */}
      <View style={styles.bottom}>
        <Text style={styles.bottomText}>National Savings Bank</Text>
        <Text style={styles.bottomText}>Welfare Division</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NAVY,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: '6%',
    paddingTop: 60,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    padding: 4,
  },
  card: {
    flex: 1,
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 70, // leave space for footer
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    width: '100%',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F33',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  emptyText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#2b2b33ff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  nameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emailText: {
    color: '#ccc',
    fontSize: 12,
  },
  roleText: {
    color: '#FFB600',
    fontSize: 12,
    marginTop: 4,
  },
  picker: {
    backgroundColor: CREAM,
    borderRadius: 8,
    height: 40,
    marginHorizontal: 6,
  },
  assignButton: {
    backgroundColor: YELLOW,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    marginLeft: 6,
  },
  assignButtonText: {
    color: NAVY,
    fontWeight: '700',
    fontSize: 12,
  },
  bottom: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bottomText: {
    color: '#FFFFFF',
    fontSize: 11,
    opacity: 0.8,
  },
});
