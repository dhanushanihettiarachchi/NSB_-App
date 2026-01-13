// src/services/api.ts
import { Platform } from "react-native";

const DEV_WEB = "http://localhost:3001";
const DEV_ANDROID = "http://10.0.2.2:3001";
// ✅ IMPORTANT: change this to your PC IP when using real phone on WiFi
const DEV_DEVICE = "http://192.168.1.20:3001";

export const API_BASE =
  Platform.OS === "web"
    ? DEV_WEB
    : Platform.OS === "android"
    ? DEV_ANDROID
    : DEV_DEVICE;

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, id };
}

async function request(path: string, options: RequestInit = {}) {
  const { controller, id } = withTimeout(20000); // ✅ 20s timeout

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });

    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timeout. Check API connection / WiFi.");
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}

export const bookingsApi = {
  list: (status: string = "All") =>
    request(`/bookings?status=${encodeURIComponent(status)}`),

  approve: (id: number | string, admin_id: number) =>
    request(`/bookings/${id}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ admin_id }),
    }),

  reject: (id: number | string, admin_id: number, reason: string) =>
    request(`/bookings/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ admin_id, reason }),
    }),
};

export const paymentsApi = {
  latestByBooking: (bookingId: number | string) =>
    request(`/payments/booking/${bookingId}/latest`),
};
