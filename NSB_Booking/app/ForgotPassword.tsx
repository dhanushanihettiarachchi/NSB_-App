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

export default function ForgotPasswordScreen() {
  const [phone, setPhone] = useState('');

  const handleSend = () => {
    // TODO API
    router.push('/Verification');
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
            <Text style={globalStyles.headingMain}>Forgot Password</Text>
          </View>
        </View>

        <View style={globalStyles.formCard}>
          <Text style={styles.infoText}>
            Enter your mobile number to receive a verification code.
          </Text>

          <TextInput
            style={globalStyles.input}
            placeholder="Type your mobile number here"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <TouchableOpacity style={globalStyles.primaryButton} onPress={handleSend}>
            <Text style={globalStyles.primaryButtonText}>Send</Text>
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
    marginRight: 30,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 12,
  },
});
