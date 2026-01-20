// NSB_Booking/src/services/api.ts
import { API_URL } from "./config";

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, id };
}

async function request(path: string, options: RequestInit = {}) {
  const { controller, id } = withTimeout(20000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const text = await res.text();
    let data: any;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      throw new Error(data?.message || "Request failed");
    }

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
