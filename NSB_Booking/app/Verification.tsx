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
import { globalStyles, NSB_COLORS } from '@/styles/global';

export default function VerificationScreen() {
  const [otp, setOtp] = useState(['', '', '', '']);

  const handleChange = (val: string, index: number) => {
    if (val.length > 1) return;
    const updated = [...otp];
    updated[index] = val;
    setOtp(updated);
  };

  const handleVerify = () => {
    // TODO API
    router.push('/NewPassword');
  };

  const handleResend = () => {
    // TODO API
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={globalStyles.screenContainer}>
        <View style={globalStyles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={globalStyles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={globalStyles.headingMain}>Verification</Text>
          </View>
        </View>

        <View style={globalStyles.formCard}>
          <Text style={styles.infoText}>Enter verification code.</Text>

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
            If you don’t receive code,&nbsp;
            <Text style={styles.resendLink} onPress={handleResend}>
              Resend.
            </Text>
          </Text>

          <TouchableOpacity style={globalStyles.primaryButton} onPress={handleVerify}>
            <Text style={globalStyles.primaryButtonText}>Verify</Text>
          </TouchableOpacity>
        </View>

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
    marginRight: 35,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpBox: {
    width: 50,
    height: 50,
    backgroundColor: '#FFEFD5',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    color: '#333',
    fontWeight: '600',
  },
  resendText: {
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 20,
  },
  resendLink: {
    color: NSB_COLORS.gold,
    fontWeight: '600',
  },
});
