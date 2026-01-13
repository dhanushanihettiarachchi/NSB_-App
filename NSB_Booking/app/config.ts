// app/config.ts
import { Platform } from 'react-native';

// ✅ Put this in your .env file (Expo app side):
// EXPO_PUBLIC_API_URL=http://192.168.8.110:3001
// For web dev only you can use http://localhost:3001

const ENV_URL = process.env.EXPO_PUBLIC_API_URL;

// fallback:
const WEB_URL = 'http://localhost:3001';

// ⚠️ Replace with YOUR PC LAN IP for phone
const LAN_URL = 'http://192.168.8.110:3001';

export const API_URL =
  ENV_URL ||
  (Platform.OS === 'web' ? WEB_URL : LAN_URL);
