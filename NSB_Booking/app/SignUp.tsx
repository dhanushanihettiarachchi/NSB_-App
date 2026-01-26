// NSB Booking App - Sign Up Screen (UPDATED: EPF field moved after Last Name)
// NSB_Booking/app/SignUp.tsx

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../src/services/config';

/* ================= CONSTANTS ================= */

const NAVY = '#020038';
const YELLOW = '#FFB600';
const CARD = '#0A0A1A';
const MUTED = 'rgba(255,255,255,0.7)';

// ✅ Change this to your real NSB domain
const NSB_DOMAIN = '@nsb.lk';

type FocusField =
  | 'firstName'
  | 'lastName'
  | 'epf'
  | 'email'
  | 'phone'
  | 'password'
  | 'confirm'
  | null;

/* ================= COMPONENT ================= */

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [epf, setEpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusField, setFocusField] = useState<FocusField>(null);

  const emailLower = useMemo(() => email.trim().toLowerCase(), [email]);

  const isValidEmail = useMemo(() => {
    return (
      emailLower.includes('@') &&
      emailLower.includes('.') &&
      emailLower.endsWith(NSB_DOMAIN)
    );
  }, [emailLower]);

  const isValidEpf = useMemo(() => {
    return /^[0-9]{3,20}$/.test(epf.trim());
  }, [epf]);

  /* ================= HANDLER ================= */

  const handleSignUp = async () => {
    setError('');

    const f = firstName.trim();
    const l = lastName.trim();
    const epfNumber = epf.trim();
    const e = email.trim().toLowerCase();
    const p = phone.trim();

    if (!f || !l || !epfNumber || !e || !password || !confirm) {
      setError('Please fill all fields.');
      return;
    }

    if (!e.endsWith(NSB_DOMAIN)) {
      setError(`Please use your NSB email (${NSB_DOMAIN}).`);
      return;
    }

    if (!isValidEpf) {
      setError('Please enter a valid EPF number.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: f,
          last_name: l,
          epf_number: epfNumber,
          email: e,
          phone: p || null,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || 'Sign up failed.');
        return;
      }

      router.replace('/SignIn');
    } catch (e) {
      console.error(e);
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  return (
    <LinearGradient colors={['#020038', '#05004A', '#020038']} style={styles.background}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Back Arrow */}
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to continue</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* First Name */}
          <Text style={styles.label}>First Name</Text>
          <View style={[styles.inputWrap, focusField === 'firstName' && styles.inputFocus]}>
            <Ionicons name="person-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={firstName}
              onChangeText={setFirstName}
              onFocus={() => setFocusField('firstName')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          {/* Last Name */}
          <Text style={[styles.label, { marginTop: 12 }]}>Last Name</Text>
          <View style={[styles.inputWrap, focusField === 'lastName' && styles.inputFocus]}>
            <Ionicons name="person-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={lastName}
              onChangeText={setLastName}
              onFocus={() => setFocusField('lastName')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          {/* EPF Number (moved here) */}
          <Text style={[styles.label, { marginTop: 12 }]}>EPF Number</Text>
          <View style={[styles.inputWrap, focusField === 'epf' && styles.inputFocus]}>
            <Ionicons name="id-card-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              placeholder="EPF Number"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={epf}
              onChangeText={setEpf}
              keyboardType="number-pad"
              onFocus={() => setFocusField('epf')}
              onBlur={() => setFocusField(null)}
            />
            {!!epf.trim() && (
              <Ionicons
                name={isValidEpf ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={isValidEpf ? '#4ADE80' : '#FB7185'}
              />
            )}
          </View>

          {/* Email */}
          <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
          <View style={[styles.inputWrap, focusField === 'email' && styles.inputFocus]}>
            <Ionicons name="mail-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              placeholder={`name${NSB_DOMAIN}`}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusField('email')}
              onBlur={() => setFocusField(null)}
            />
            {!!email.trim() && (
              <Ionicons
                name={isValidEmail ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={isValidEmail ? '#4ADE80' : '#FB7185'}
              />
            )}
          </View>

          {/* Phone */}
          <Text style={[styles.label, { marginTop: 12 }]}>Mobile Number</Text>
          <View style={[styles.inputWrap, focusField === 'phone' && styles.inputFocus]}>
            <Ionicons name="call-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              placeholder="07XXXXXXXX"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              onFocus={() => setFocusField('phone')}
              onBlur={() => setFocusField(null)}
            />
          </View>

          {/* Password */}
          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <View style={[styles.inputWrap, focusField === 'password' && styles.inputFocus]}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              onFocus={() => setFocusField('password')}
              onBlur={() => setFocusField(null)}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={MUTED}
              />
            </Pressable>
          </View>

          {/* Confirm Password */}
          <Text style={[styles.label, { marginTop: 12 }]}>Confirm Password</Text>
          <View style={[styles.inputWrap, focusField === 'confirm' && styles.inputFocus]}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              onFocus={() => setFocusField('confirm')}
              onBlur={() => setFocusField(null)}
            />
            <Pressable onPress={() => setShowConfirm(!showConfirm)} hitSlop={10}>
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={MUTED}
              />
            </Pressable>
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom */}
        <View style={styles.bottom}>
          <Text style={styles.bottomText}>National Savings Bank</Text>
          <Text style={styles.bottomText}>Welfare Division</Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  background: { flex: 1 },

  screen: {
    flex: 1,
    paddingHorizontal: '7%',
    paddingTop: 60,
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

  header: {
    alignItems: 'center',
    marginBottom: 18,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },

  subtitle: {
    color: MUTED,
    fontSize: 13,
    marginTop: 6,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },

  label: {
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '600',
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  inputFocus: {
    borderColor: YELLOW,
    backgroundColor: 'rgba(255,182,0,0.08)',
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },

  errorText: {
    color: '#FB7185',
    fontSize: 12,
    marginTop: 10,
  },

  button: {
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: NAVY,
    fontWeight: '900',
    fontSize: 16,
  },

  bottom: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  bottomText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
  },
});
