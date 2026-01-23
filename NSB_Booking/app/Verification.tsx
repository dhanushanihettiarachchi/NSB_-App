// NSB Booking App - Verification Screen
// D:\NSB_App\NSB_Booking\app\Verification.tsx
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

const NAVY = '#020038';
const YELLOW = '#FFB600';
const CREAM = '#FFEBD3';
const BLACK_BOX = '#050515';

export default function VerificationScreen() {
  const [otp, setOtp] = useState<string[]>(['', '', '', '']);

  const handleChange = (val: string, index: number) => {
    if (val.length > 1) return;
    const updated = [...otp];
    updated[index] = val;
    setOtp(updated);
  };

  const handleVerify = () => {
    // TODO: verify OTP with backend
    router.push('/NewPassword');
  };

  const handleResend = () => {
    // TODO: resend OTP via backend
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back arrow */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Verification</Text>
      <Text style={styles.subtitle}>Enter the verification code</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Code</Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              style={styles.otpBox}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(v) => handleChange(v, index)}
            />
          ))}
        </View>

        <Text style={styles.resendText}>
          If you don’t receive the code,&nbsp;
          <Text style={styles.resendLink} onPress={handleResend}>
            Resend.
          </Text>
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleVerify}>
          <Text style={styles.buttonText}>Verify</Text>
        </TouchableOpacity>
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
  topRow: {
    position: 'absolute',
    top: 40,
    left: 20,
  },
  backButton: {
    padding: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.8,
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
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  otpBox: {
    width: 50,
    height: 50,
    backgroundColor: CREAM,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    color: '#333',
    fontWeight: '600',
  },
  resendText: {
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 18,
  },
  resendLink: {
    color: YELLOW,
    fontWeight: '600',
  },
  button: {
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  buttonText: {
    color: NAVY,
    fontWeight: '700',
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
    color: '#FFFFFF',
    fontSize: 11,
    opacity: 0.8,
  },
});
