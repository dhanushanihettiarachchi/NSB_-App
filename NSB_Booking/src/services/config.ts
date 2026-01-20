// src/config.ts

const API_URL_RAW = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL_RAW) {
  throw new Error(
    "Missing EXPO_PUBLIC_API_URL. Add it to NSB_Booking/.env and restart Expo with: npx expo start -c"
  );
}

export const API_URL = API_URL_RAW.replace(/\/+$/, "");
