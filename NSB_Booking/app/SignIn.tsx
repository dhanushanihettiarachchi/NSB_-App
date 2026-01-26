// NSB Booking App - Sign In Screen (UPDATED: checks NSB email domain + saves session to AsyncStorage)
// NSB_Booking/app/SignIn.tsx

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../src/services/config';

/* ================= CONSTANTS ================= */

const NAVY = '#020038';
const YELLOW = '#FFB600';
const CARD = '#0A0A1A';
const MUTED = 'rgba(255,255,255,0.7)';

// ✅ Change this to your real NSB domain
const NSB_DOMAIN = '@nsb.lk';

/* ================= TYPES ================= */

type FocusField = 'email' | 'password' | null;

/* ================= COMPONENT ================= */

export default function SignInScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [focusField, setFocusField] = useState<FocusField>(null);

  const emailLower = useMemo(() => email.trim().toLowerCase(), [email]);

  const isValidEmail = useMemo(() => {
    return emailLower.includes('@') && emailLower.includes('.');
  }, [emailLower]);

  const isNsbEmail = useMemo(() => {
    return !!emailLower && emailLower.endsWith(NSB_DOMAIN);
  }, [emailLower]);

  /* ================= HANDLER ================= */

  const handleSignIn = async () => {
    setError('');

    const e = email.trim().toLowerCase();
    const pw = password.trim();

    if (!e || !pw) {
      setError('Please enter your email and password.');
      return;
    }

    // ✅ NSB domain check (same as signup)
    if (!e.endsWith(NSB_DOMAIN)) {
      setError(`Only NSB emails can sign in (${NSB_DOMAIN}).`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: e,
          password: pw,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || 'Invalid email or password.');
        return;
      }

      const role = data?.user?.role ?? '';
      const userId = data?.user?.user_id;

      const firstName = data?.user?.first_name ?? '';
      const lastName = data?.user?.last_name ?? '';
      const userEmail = data?.user?.email ?? e;

      if (!userId) {
        setError('Login succeeded but userId is missing.');
        return;
      }

      // ✅ IMPORTANT: persist login (so EditCircuit & AdminDashboard always find user)
      await AsyncStorage.multiSet([
        ['user_id', String(userId)],
        ['userId', String(userId)], // keep both keys (your other screens search multiple keys)
        ['email', String(userEmail)],
        ['first_name', String(firstName)],
        ['last_name', String(lastName)],
        ['role', String(role)],
      ]);

      // ✅ also keep params navigation working (no change for your dashboards)
      const commonParams = {
        userId: String(userId),
        firstName,
        lastName,
        email: userEmail,
        role,
      };

      if (role === 'SuperAdmin') {
        router.replace({ pathname: '/AdminDashboard', params: commonParams });
      } else if (role === 'BranchManager') {
        router.replace({ pathname: '/ManagerDashboard', params: commonParams });
      } else {
        router.replace({ pathname: '/UserDashboard', params: commonParams });
      }
    } catch (err) {
      console.error(err);
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
        {/* Header with Logo */}
        <View style={styles.header}>
          <Image
            source={require('../assets/images/nsb/nsb-logo-new.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Welcome back. Please Sign In to continue.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputWrap, focusField === 'email' && styles.inputFocus]}>
            <Ionicons name="mail-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              placeholder={`name${NSB_DOMAIN}`}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setFocusField('email')}
              onBlur={() => setFocusField(null)}
            />
            {!!email.trim() && (
              <Ionicons
                name={isValidEmail && isNsbEmail ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={isValidEmail && isNsbEmail ? '#4ADE80' : '#FB7185'}
              />
            )}
          </View>

          {/* Password */}
          <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
          <View style={[styles.inputWrap, focusField === 'password' && styles.inputFocus]}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
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

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Forgot */}
          <TouchableOpacity style={styles.forgot} onPress={() => router.push('/ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/SignUp')}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Text */}
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
    paddingTop: 70,
  },

  header: {
    alignItems: 'center',
    marginBottom: 22,
  },

  logo: {
    width: 140,
    height: 60,
    marginBottom: 14,
  },

  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },

  subtitle: {
    color: MUTED,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
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
    color: '#fff',
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
    color: '#fff',
    fontSize: 14,
  },

  errorText: {
    color: '#FB7185',
    fontSize: 12,
    marginTop: 8,
  },

  forgot: {
    alignItems: 'flex-end',
    marginTop: 14,
  },

  forgotText: {
    color: YELLOW,
    fontSize: 12,
    fontWeight: '600',
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

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
  },

  footerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },

  footerLink: {
    color: YELLOW,
    fontSize: 13,
    fontWeight: '800',
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
