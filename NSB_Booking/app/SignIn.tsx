import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { globalStyles, NSB_COLORS } from '@/styles/global';

const API_URL = 'http://localhost:3001';

export default function SignInScreen() {
  const [epf, setEpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epf: epf.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      setLoading(false);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Login error:', err);
      setError('Cannot connect to server');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={globalStyles.screenContainer}>

        {/* Header Centered */}
        <View style={styles.headerCenter}>
          <Text style={styles.heading}>Sign In to Continue</Text>
        </View>

        {/* Form */}
        <View style={globalStyles.formCard}>
          <Text style={globalStyles.label}>Employee ID</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Type your employee ID here"
            placeholderTextColor="#999"
            value={epf}
            onChangeText={setEpf}
          />

          <Text style={[globalStyles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Type your password here"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Error message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Forgot Password */}
          <TouchableOpacity onPress={() => router.push('/ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={globalStyles.primaryButton}
            onPress={handleSignIn}
            disabled={loading}
          >
            <Text style={globalStyles.primaryButtonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={{ marginTop: 16 }}>
            <Text style={styles.smallText}>
              Don’t have an account?{' '}
              <Text
                style={globalStyles.linkText}
                onPress={() => router.push('/SetPassword')}
              >
                Sign Up
              </Text>
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={globalStyles.footer}>
          <Text style={globalStyles.footerText}>National Savings Bank</Text>
          <Text style={globalStyles.footerText}>Welfare Division</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerCenter: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  heading: {
    ...globalStyles.headingMain,
    fontSize: 20,
    textAlign: 'center',
  },
  forgotText: {
    color: NSB_COLORS.gold,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  smallText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 6,
  },
});
