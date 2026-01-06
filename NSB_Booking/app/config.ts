import { Platform } from 'react-native';

export const API_URL =
  Platform.OS === 'web'
    ? 'http://localhost:3001'
    : 'http://192.168.8.110:3001';
