export type DemoBooking = {
  id: string;
  turfId: number;
  turfName: string;
  date: string;
  time: string;
  priceInr: number;
  demoEth: string;
  recurringGroup?: string;
  status: "active" | "cancelled";
  createdAt: string;
};

const KEY = "playslot.demo.bookings.v1";

export function loadDemoBookings(): DemoBooking[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DemoBooking[];
  } catch {
    return [];
  }
}

export function saveDemoBookings(bookings: DemoBooking[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(bookings));
}

export function clearDemoBookings() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
