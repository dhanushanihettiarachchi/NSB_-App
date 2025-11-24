import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { globalStyles } from '@/styles/global';

// API URL (web: localhost, device: change to your WiFi IP)
const API_URL = 'http://localhost:3001';

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [epf, setEpf] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignUp = async () => {
    setError('');
    setSuccess('');

    if (!fullName || !epf || !email || !mobile || !password || !confirmPassword) {
      setError('Please fill all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          epf: epf.trim(),
          email: email.trim(),
          phone: mobile.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Unable to create account');
        setLoading(false);
        return;
      }

      setSuccess(data.message || 'Account created successfully');
      setLoading(false);

      // After success, go back to SignIn
      setTimeout(() => {
        router.replace('/SignIn');
      }, 1500);
    } catch (err) {
      console.error('Sign up error:', err);
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
        {/* Header */}
        <View style={globalStyles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={globalStyles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={globalStyles.headingMain}>Sign Up</Text>
            <Text style={globalStyles.headingSmall}>Create your NSB account</Text>
          </View>
        </View>

        {/* Form */}
        <View style={globalStyles.formCard}>
          <Text style={globalStyles.label}>Full Name</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Type your full name here"
            placeholderTextColor="#999"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={[globalStyles.label, styles.topMargin]}>Employee ID (EPF)</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Type your employee ID here"
            placeholderTextColor="#999"
            value={epf}
            onChangeText={setEpf}
          />

          <Text style={[globalStyles.label, styles.topMargin]}>Email</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Type your email here"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={[globalStyles.label, styles.topMargin]}>Mobile Number</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Type your mobile number here"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={setMobile}
          />

          <Text style={[globalStyles.label, styles.topMargin]}>Password</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Type your password here"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text style={[globalStyles.label, styles.topMargin]}>Confirm Password</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Confirm your password"
            placeholderTextColor="#999"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <TouchableOpacity
            style={globalStyles.primaryButton}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={globalStyles.primaryButtonText}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>
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
    flex: 1,
    alignItems: 'center',
    marginRight: 30,
  },
  topMargin: {
    marginTop: 12,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 8,
  },
  successText: {
    color: 'lightgreen',
    fontSize: 12,
    marginTop: 8,
  },
});
