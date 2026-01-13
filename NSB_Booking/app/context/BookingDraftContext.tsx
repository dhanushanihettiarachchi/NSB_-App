// app/context/BookingDraftContext.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';

export type DraftItem = {
  room_id: number;
  room_name: string;
  need_room_count: number;
  guest_count: number;
  max_persons: number;
  price_per_person: number;
};

export type BookingDraft = {
  userId: number;

  // circuit info (used in UI)
  circuitId?: string;
  circuitName?: string;
  city?: string;
  street?: string;

  // booking details
  check_in_date?: string;
  check_out_date?: string;
  booking_time?: string | null;
  purpose?: string | null;

  nights?: number;

  items?: DraftItem[];

  totalGuests?: number;
  totalRooms?: number;
  totalCapacity?: number;
  grandTotal?: number;

  // existing bookings (pay later)
  booking_ids?: number[];

  // ✅ NEW: mark slip status in UI (until backend is connected)
  paymentProofUploaded?: boolean;
};

type Ctx = {
  draft: BookingDraft | null;
  setDraft: (d: BookingDraft | null) => void;
  patchDraft: (partial: Partial<BookingDraft>) => void;
  clearDraft: () => void;
};

const BookingDraftContext = createContext<Ctx | null>(null);

export function BookingDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft | null>(null);

  const patchDraft = (partial: Partial<BookingDraft>) => {
    setDraft((prev) => ({ ...(prev || ({} as BookingDraft)), ...partial }));
  };

  const clearDraft = () => setDraft(null);

  const value = useMemo(
    () => ({ draft, setDraft, patchDraft, clearDraft }),
    [draft]
  );

  return <BookingDraftContext.Provider value={value}>{children}</BookingDraftContext.Provider>;
}

export function useBookingDraft() {
  const ctx = useContext(BookingDraftContext);
  if (!ctx) throw new Error('useBookingDraft must be used inside BookingDraftProvider');
  return ctx;
}
