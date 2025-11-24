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

export default function NewPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = () => {
    // TODO API
    router.replace('/SignIn');
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
            <Text style={globalStyles.headingMain}>New Password</Text>
          </View>
        </View>

        <View style={globalStyles.formCard}>
          <Text style={globalStyles.label}>Enter your new password</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Type your new password here"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text style={[globalStyles.label, styles.topMargin]}>
            Enter your new password
          </Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Confirm your password"
            placeholderTextColor="#999"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity style={globalStyles.primaryButton} onPress={handleSubmit}>
            <Text style={globalStyles.primaryButtonText}>Submit</Text>
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
  topMargin: {
    marginTop: 12,
  },
});
