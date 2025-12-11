import React, { useState } from 'react'; 
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';

const NAVY = '#020038';
const YELLOW = '#FFB600';
const CREAM = '#FFEBD3';
const BLACK_BOX = '#050515';

const API_URL =
  Platform.OS === 'web'
    ? 'http://localhost:3001'
    : 'http://192.168.8.111:3001';


export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      console.log('Login response >>>', data); // just to check in console

      if (!res.ok) {
        setError(data.message || 'Invalid email or password.');
        return;
      }

      // ⭐️ ROLE BASED NAVIGATION ⭐️
      const role = data?.user?.role; // this comes from your backend

      if (role === 'SuperAdmin') {
        router.replace('/AdminDashboard');
      } else if (role === 'BranchManager') {
        router.replace('/ManagerDashboard');
      } else {
        // EndUser or anything else
        router.replace('/UserDashboard');
      }
    } catch (e) {
      console.error(e);
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Sign In to continue</Text>
      <View style={styles.card}>
        {/* Email */}
        <Text style={styles.label}>email</Text>
        <TextInput
          style={styles.input}
          placeholder="Type your email here"
          placeholderTextColor="#B0A9A0"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Type your password here"
          placeholderTextColor="#B0A9A0"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.forgotRow}
          onPress={() => router.push('/ForgotPassword')}
        >
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/SignUp')}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.bottomText}>National Savings Bank</Text>
        <Text style={styles.bottomText}>Welfare Division</Text>
      </View>
    </KeyboardAvoidingView>
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
  card: {
    width: '100%',
    backgroundColor: BLACK_BOX,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  input: {
    backgroundColor: CREAM,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 14,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    color: YELLOW,
    fontSize: 12,
  },
  button: {
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: NAVY,
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginBottom: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  footerText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  footerLink: {
    color: YELLOW,
    fontSize: 13,
    fontWeight: '600',
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
