"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import WalletButton from "@/components/WalletButton";
import { turfs, timeSlots } from "@/data/turfs";
import {
  contractAddress,
  playSlotAbi,
  walletEnabled,
} from "@/lib/web3/contract";
import { monadTestnet } from "@/lib/web3/config";

type Tab = "discover" | "book" | "bookings" | "board";
type Toast = { type: "success" | "info" | "warn"; text: string } | null;

type ChainBooking = {
  id: bigint;
  customer: `0x${string}`;
  turfId: number;
  startTime: bigint;
  amountPaid: bigint;
  status: number;
};

const notices = [
  {
    tag: "UPDATE",
    title: "Weekend slots fill fast",
    body: "For Saturday and Sunday evening games, booking at least 24 hours early is recommended.",
  },
  {
    tag: "MAINTENANCE",
    title: "SkyCourt surface check",
    body: "SkyCourt has a scheduled surface inspection on Wednesday from 4:00–5:00 PM.",
  },
  {
    tag: "COMMUNITY",
    title: "Friday 5-a-side mixer",
    body: "Solo players can join the open mixer at Neon Arena. Ask the venue contact for availability.",
  },
];

const rules = [
  "Reach the venue 10 minutes before your slot.",
  "Studs with metal spikes are not allowed on synthetic turf.",
  "No smoking, alcohol or glass bottles inside the playing area.",
  "Players are responsible for personal belongings.",
  "Bookings can be adjusted only if the requested new slot is available.",
  "On-chain refund policy: >24h = 90%, 4–24h = 50%, <=4h = no refund.",
];

function todayString() {
  const d = new Date();
  const tzAdjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return tzAdjusted.toISOString().split("T")[0];
}

function addDays(dateString: string, days: number) {
  const d = new Date(`${dateString}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function prettyDate(dateString: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateString}T12:00:00`));
}

function toTimestamp(dateString: string, time: string) {
  const [clock, meridiem] = time.split(" ");
  const [rawHour, minute] = clock.split(":").map(Number);
  let hour = rawHour;

  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  const d = new Date(`${dateString}T00:00:00`);
  d.setHours(hour, minute, 0, 0);
  return BigInt(Math.floor(d.getTime() / 1000));
}

function timestampToDateInput(timestamp: bigint) {
  const d = new Date(Number(timestamp) * 1000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().split("T")[0];
}

function timestampToTime(timestamp: bigint) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(Number(timestamp) * 1000))
    .toUpperCase();
}

function prettyTimestamp(timestamp: bigint) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(Number(timestamp) * 1000));
}

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function errorText(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { shortMessage?: string; message?: string };
    const text = candidate.shortMessage || candidate.message;
    if (text) {
      if (text.includes("User rejected") || text.includes("user rejected")) {
        return "Transaction cancelled in MetaMask.";
      }
      if (text.includes("SlotAlreadyBooked")) {
        return "One of those slots has already been booked.";
      }
      if (text.includes("InvalidStartTime")) {
        return "That slot is in the past. Choose a future time.";
      }
      if (text.includes("WrongPayment")) {
        return "The payment amount does not match the contract price.";
      }
      return text.length > 150 ? `${text.slice(0, 150)}…` : text;
    }
  }
  return "Transaction failed. Please try again.";
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("discover");
  const [selectedTurfId, setSelectedTurfId] = useState(1);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [selectedTimes, setSelectedTimes] = useState<string[]>(["07:00 PM"]);
  const [recurring, setRecurring] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [toast, setToast] = useState<Toast>(null);
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editDate, setEditDate] = useState(todayString());
  const [editTime, setEditTime] = useState("06:00 PM");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: monadTestnet.id });
  const { writeContractAsync } = useWriteContract();

  const onCorrectChain = isConnected && chainId === monadTestnet.id;

  const {
    data: bookingData,
    refetch: refetchBookings,
    isFetching: loadingBookings,
  } = useReadContract({
    address: contractAddress,
    abi: playSlotAbi,
    functionName: "getCustomerBookings",
    args: address ? [address] : undefined,
    query: {
      enabled:
        walletEnabled &&
        Boolean(address) &&
        isConnected &&
        chainId === monadTestnet.id,
    },
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const chainBookings = useMemo(
    () => (bookingData ?? []) as readonly ChainBooking[],
    [bookingData],
  );

  const activeBookings = useMemo(
    () => chainBookings.filter((booking) => Number(booking.status) === 0),
    [chainBookings],
  );

  const cancelledBookings = useMemo(
    () => chainBookings.filter((booking) => Number(booking.status) === 1),
    [chainBookings],
  );

  const selectedTurf = useMemo(
    () => turfs.find((turf) => turf.id === selectedTurfId) ?? turfs[0],
    [selectedTurfId],
  );

  const occurrences = recurring ? weeks : 1;
  const bookingCount = selectedTimes.length * occurrences;
  const totalInr = selectedTurf.priceInr * bookingCount;
  const totalMon = Number(selectedTurf.demoEth) * bookingCount;

  const ownBookedKeys = useMemo(() => {
    return new Set(
      activeBookings.map(
        (booking) => `${booking.turfId}|${booking.startTime.toString()}`,
      ),
    );
  }, [activeBookings]);

  function isOwnBooked(turfId: number, date: string, time: string) {
    return ownBookedKeys.has(`${turfId}|${toTimestamp(date, time).toString()}`);
  }

  function toggleTime(time: string) {
    const unavailable = Array.from({ length: occurrences }).some((_, index) =>
      isOwnBooked(selectedTurfId, addDays(selectedDate, index * 7), time),
    );

    if (unavailable) {
      setToast({ type: "warn", text: "You already booked that slot." });
      return;
    }

    setSelectedTimes((current) =>
      current.includes(time)
        ? current.filter((value) => value !== time)
        : [...current, time],
    );
  }

  async function verifyAvailability() {
    if (!publicClient) return true;

    const checks: Promise<boolean>[] = [];
    for (let weekIndex = 0; weekIndex < occurrences; weekIndex++) {
      const date = addDays(selectedDate, weekIndex * 7);
      for (const time of selectedTimes) {
        checks.push(
          publicClient.readContract({
            address: contractAddress,
            abi: playSlotAbi,
            functionName: "isSlotAvailable",
            args: [selectedTurfId, toTimestamp(date, time)],
          }) as Promise<boolean>,
        );
      }
    }

    const results = await Promise.all(checks);
    return results.every(Boolean);
  }

  async function finishTransaction(hash: `0x${string}`, successMessage: string) {
    if (!publicClient) throw new Error("Monad RPC client is unavailable.");

    setToast({
      type: "info",
      text: `Transaction sent ${shortHash(hash)}. Waiting for confirmation…`,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted.");

    await refetchBookings();
    setToast({ type: "success", text: successMessage });
  }

  async function createBookings() {
    if (!walletEnabled) {
      setToast({ type: "warn", text: "Wallet mode is disabled in .env.local." });
      return;
    }
    if (!isConnected) {
      setToast({ type: "warn", text: "Connect your PlaySlot wallet first." });
      return;
    }
    if (!onCorrectChain) {
      setToast({ type: "warn", text: "Switch MetaMask to Monad Testnet first." });
      return;
    }
    if (selectedTimes.length === 0) {
      setToast({ type: "warn", text: "Select at least one time slot first." });
      return;
    }

    const firstStartTimes = selectedTimes.map((time) =>
      toTimestamp(selectedDate, time),
    );

    if (firstStartTimes.some((time) => time <= BigInt(Math.floor(Date.now() / 1000)))) {
      setToast({ type: "warn", text: "Choose a future time slot." });
      return;
    }

    setPendingAction("booking");
    try {
      const available = await verifyAvailability();
      if (!available) {
        setToast({
          type: "warn",
          text: "One of the selected slots was already booked. Pick another slot.",
        });
        return;
      }

      const value = parseEther(selectedTurf.demoEth) * BigInt(bookingCount);
      let hash: `0x${string}`;

      if (recurring) {
        hash = await writeContractAsync({
          address: contractAddress,
          abi: playSlotAbi,
          functionName: "bookRecurringSlots",
          args: [selectedTurfId, firstStartTimes, 7, weeks],
          value,
        });
      } else {
        hash = await writeContractAsync({
          address: contractAddress,
          abi: playSlotAbi,
          functionName: "bookSlots",
          args: [selectedTurfId, firstStartTimes],
          value,
        });
      }

      await finishTransaction(
        hash,
        `${bookingCount} reservation${bookingCount > 1 ? "s" : ""} confirmed on Monad Testnet.`,
      );
      setSelectedTimes([]);
      setTab("bookings");
    } catch (error) {
      setToast({ type: "warn", text: errorText(error) });
    } finally {
      setPendingAction(null);
    }
  }

  async function cancelBooking(id: bigint) {
    if (!onCorrectChain) {
      setToast({ type: "warn", text: "Connect to Monad Testnet first." });
      return;
    }

    setPendingAction(`cancel-${id}`);
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: playSlotAbi,
        functionName: "cancelBooking",
        args: [id],
      });
      await finishTransaction(hash, `Booking #${id.toString()} cancelled on-chain.`);
    } catch (error) {
      setToast({ type: "warn", text: errorText(error) });
    } finally {
      setPendingAction(null);
    }
  }

  function startEdit(booking: ChainBooking) {
    setEditingId(booking.id);
    setEditDate(timestampToDateInput(booking.startTime));
    setEditTime(timestampToTime(booking.startTime));
  }

  async function saveEdit(booking: ChainBooking) {
    if (!onCorrectChain) {
      setToast({ type: "warn", text: "Connect to Monad Testnet first." });
      return;
    }

    const newStartTime = toTimestamp(editDate, editTime);
    if (newStartTime <= BigInt(Math.floor(Date.now() / 1000))) {
      setToast({ type: "warn", text: "Choose a future time slot." });
      return;
    }

    setPendingAction(`adjust-${booking.id}`);
    try {
      if (publicClient) {
        const available = await publicClient.readContract({
          address: contractAddress,
          abi: playSlotAbi,
          functionName: "isSlotAvailable",
          args: [booking.turfId, newStartTime],
        });
        if (!available) {
          setToast({ type: "warn", text: "That new slot is already booked." });
          return;
        }
      }

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: playSlotAbi,
        functionName: "adjustBooking",
        args: [booking.id, booking.turfId, newStartTime],
        value: 0n,
      });

      await finishTransaction(
        hash,
        `Booking #${booking.id.toString()} moved successfully.`,
      );
      setEditingId(null);
    } catch (error) {
      setToast({ type: "warn", text: errorText(error) });
    } finally {
      setPendingAction(null);
    }
  }

  const navItems: { id: Tab; label: string; icon: string }[] = [
    { id: "discover", label: "Discover", icon: "✦" },
    { id: "book", label: "Book Turf", icon: "◉" },
    { id: "bookings", label: "My Bookings", icon: "▣" },
    { id: "board", label: "Board & Rules", icon: "☰" },
  ];

  return (
    <main className="min-h-screen grid-bg">
      {toast && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 px-4">
          <div
            className={`glass max-w-lg rounded-2xl px-5 py-3 text-sm font-semibold ${
              toast.type === "success"
                ? "border-emerald-400/30 text-emerald-200"
                : toast.type === "warn"
                  ? "border-amber-400/30 text-amber-200"
                  : "border-cyan-400/30 text-cyan-100"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <button
            onClick={() => setTab("discover")}
            className="group flex items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-xl font-black shadow-lg shadow-violet-500/20 transition group-hover:rotate-6">
              P
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight">PlaySlot</span>
              <span className="block text-[10px] uppercase tracking-[0.28em] text-slate-500">
                Web3 Turf Booking
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1 md:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  tab === item.id
                    ? "bg-white text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <WalletButton />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-28 pt-8">
        <div className="mb-6 flex gap-2 overflow-x-auto md:hidden">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm ${
                tab === item.id
                  ? "border-white bg-white text-slate-950"
                  : "border-white/10 bg-white/[0.03] text-slate-300"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {tab === "discover" && (
          <section className="space-y-10">
            <div className="glass relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
              <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
              <div className="absolute bottom-[-8rem] left-[35%] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="relative max-w-3xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
                  <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_14px_rgba(190,242,100,.8)]" />
                  Monad Testnet • Live Contract
                </div>
                <h1 className="max-w-3xl text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-6xl">
                  Your game.
                  <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                    {" "}Your slot.
                  </span>
                  <br />
                  No booking chaos.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                  Book single sessions, grab multiple hours, lock weekly games,
                  adjust plans and execute reservation state directly on Monad.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={() => setTab("book")}
                    className="rounded-2xl bg-white px-6 py-3.5 font-black text-slate-950 transition hover:-translate-y-0.5"
                  >
                    Book a turf →
                  </button>
                  <button
                    onClick={() => setTab("board")}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 font-bold text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    Check notices
                  </button>
                </div>
              </div>

              <div className="relative mt-10 grid gap-3 sm:grid-cols-3 lg:absolute lg:bottom-8 lg:right-8 lg:mt-0 lg:w-[390px]">
                {[
                  ["3", "Turfs"],
                  ["6 PM–11 PM", "Prime slots"],
                  [onCorrectChain ? "Live" : "Connect", "Monad status"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur"
                  >
                    <div className="font-black text-white">{value}</div>
                    <div className="mt-1 text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300">
                    Pick your vibe
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">Featured turfs</h2>
                </div>
                <button
                  onClick={() => setTab("book")}
                  className="hidden text-sm font-semibold text-slate-400 hover:text-white sm:block"
                >
                  View booking grid →
                </button>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                {turfs.map((turf) => (
                  <button
                    key={turf.id}
                    onClick={() => {
                      setSelectedTurfId(turf.id);
                      setTab("book");
                    }}
                    className="glass group overflow-hidden rounded-[1.7rem] text-left transition hover:-translate-y-1 hover:border-white/25"
                  >
                    <div
                      className={`relative h-48 overflow-hidden ${
                        turf.accent === "violet"
                          ? "bg-gradient-to-br from-violet-950 via-violet-700 to-fuchsia-500"
                          : turf.accent === "cyan"
                            ? "bg-gradient-to-br from-cyan-950 via-cyan-700 to-sky-400"
                            : "bg-gradient-to-br from-lime-950 via-emerald-700 to-lime-400"
                      }`}
                    >
                      <div className="absolute inset-0 opacity-30 grid-bg" />
                      <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-bold backdrop-blur">
                        {turf.sport}
                      </div>
                      <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                        <div>
                          <div className="text-2xl font-black">{turf.name}</div>
                          <div className="mt-1 text-xs text-white/70">{turf.location}</div>
                        </div>
                        <div className="rounded-2xl bg-black/25 px-3 py-2 text-right backdrop-blur">
                          <div className="text-lg font-black">₹{turf.priceInr.toLocaleString("en-IN")}</div>
                          <div className="text-[10px] text-white/60">per hour</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-sm leading-6 text-slate-400">{turf.tagline}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {turf.amenities.slice(0, 3).map((amenity) => (
                          <span
                            key={amenity}
                            className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] text-slate-400"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === "book" && (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <div className="glass rounded-[2rem] p-5 sm:p-7">
              <div className="mb-7">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Build your session</div>
                <h1 className="mt-2 text-3xl font-black tracking-tight">Book turf</h1>
                <p className="mt-2 text-sm text-slate-500">Select one hour, stack multiple hours, or repeat weekly.</p>
              </div>

              <div className="space-y-7">
                <div>
                  <label className="mb-3 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">1. Choose turf</label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {turfs.map((turf) => (
                      <button
                        key={turf.id}
                        onClick={() => {
                          setSelectedTurfId(turf.id);
                          setSelectedTimes([]);
                        }}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selectedTurfId === turf.id
                            ? "border-violet-400/50 bg-violet-400/10 neon-ring"
                            : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="font-black">{turf.name}</div>
                        <div className="mt-1 text-xs text-slate-500">₹{turf.priceInr.toLocaleString("en-IN")}/hr</div>
                        <div className="mt-2 text-[11px] text-cyan-300">{turf.demoEth} MON/slot</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-3 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">2. Start date</label>
                    <input
                      type="date"
                      min={todayString()}
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedTimes([]);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-violet-400/50"
                    />
                  </div>

                  <div>
                    <label className="mb-3 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">3. Booking style</label>
                    <div className="flex rounded-2xl border border-white/10 bg-white/[0.025] p-1">
                      <button
                        onClick={() => setRecurring(false)}
                        className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                          !recurring ? "bg-white text-slate-950" : "text-slate-400"
                        }`}
                      >
                        One-off
                      </button>
                      <button
                        onClick={() => setRecurring(true)}
                        className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                          recurring ? "bg-white text-slate-950" : "text-slate-400"
                        }`}
                      >
                        Weekly
                      </button>
                    </div>
                  </div>
                </div>

                {recurring && (
                  <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-cyan-100">Long-term weekly booking</div>
                        <div className="mt-1 text-xs text-slate-500">The same selected hour(s) repeat every 7 days.</div>
                      </div>
                      <select
                        value={weeks}
                        onChange={(e) => setWeeks(Number(e.target.value))}
                        className="rounded-xl border border-white/10 bg-[#101827] px-3 py-2 text-sm text-white outline-none"
                      >
                        {[2, 3, 4, 6, 8].map((count) => (
                          <option key={count} value={count}>{count} weeks</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-3 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">4. Select time slots</label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {timeSlots.map((time) => {
                      const unavailable = Array.from({ length: occurrences }).some((_, index) =>
                        isOwnBooked(selectedTurfId, addDays(selectedDate, index * 7), time),
                      );
                      const selected = selectedTimes.includes(time);

                      return (
                        <button
                          key={time}
                          onClick={() => toggleTime(time)}
                          disabled={unavailable}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            unavailable
                              ? "cursor-not-allowed border-red-400/10 bg-red-400/[0.035] text-slate-600"
                              : selected
                                ? "border-lime-300/40 bg-lime-300/10 text-lime-100 shadow-[0_0_24px_rgba(163,230,53,.08)]"
                                : "border-white/10 bg-white/[0.025] text-slate-300 hover:border-white/25"
                          }`}
                        >
                          <div className="font-black">{time}</div>
                          <div className="mt-1 text-[11px]">{unavailable ? "Booked" : selected ? "Selected ✓" : "Available"}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {recurring && selectedTimes.length > 0 && (
                  <div>
                    <div className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Recurring dates</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: weeks }, (_, index) => (
                        <span
                          key={index}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300"
                        >
                          {prettyDate(addDays(selectedDate, index * 7))}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="glass rounded-[2rem] p-6 lg:sticky lg:top-28">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Booking summary</div>
                    <h2 className="mt-2 text-2xl font-black">{selectedTurf.name}</h2>
                    <div className="mt-1 text-sm text-slate-500">{selectedTurf.location}</div>
                  </div>
                  <div className="rounded-2xl bg-violet-500/10 px-3 py-2 text-xl">⚽</div>
                </div>

                <div className="my-6 h-px bg-white/10" />

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Date</span><span className="font-semibold">{prettyDate(selectedDate)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Selected hours</span><span className="font-semibold">{selectedTimes.length}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Occurrences</span><span className="font-semibold">{occurrences}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Total reservations</span><span className="font-semibold">{bookingCount}</span></div>
                </div>

                <div className="my-6 h-px bg-white/10" />

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Display price</div>
                    <div className="mt-1 text-3xl font-black">₹{totalInr.toLocaleString("en-IN")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Testnet payment</div>
                    <div className="mt-1 font-bold text-cyan-200">{totalMon.toFixed(4)} MON</div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3 text-xs leading-5 text-cyan-100/80">
                  ⛓ Booking is live on Monad Testnet. MetaMask will ask you to approve the transaction using test MON.
                </div>

                <button
                  onClick={createBookings}
                  className="mt-5 w-full rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-5 py-4 font-black text-white shadow-lg shadow-violet-500/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={bookingCount === 0 || pendingAction !== null}
                >
                  {pendingAction === "booking" ? "Waiting for blockchain…" : `Book on Monad • ${totalMon.toFixed(4)} MON`}
                </button>

                <div className="mt-3 text-center text-[11px] text-slate-600">
                  Contract: {contractAddress ? `${contractAddress.slice(0, 8)}…${contractAddress.slice(-6)}` : "Not configured"}
                </div>
              </div>
            </aside>
          </section>
        )}

        {tab === "bookings" && (
          <section>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-lime-300">On-chain schedule</div>
                <h1 className="mt-2 text-3xl font-black tracking-tight">My bookings</h1>
                <p className="mt-2 text-sm text-slate-500">Loaded from your wallet's bookings on Monad Testnet.</p>
              </div>
              <button
                onClick={() => refetchBookings()}
                disabled={!onCorrectChain || loadingBookings}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
              >
                {loadingBookings ? "Refreshing…" : "Refresh chain data"}
              </button>
            </div>

            {!isConnected ? (
              <div className="glass flex min-h-[320px] flex-col items-center justify-center rounded-[2rem] p-8 text-center">
                <div className="text-5xl">🔗</div>
                <h2 className="mt-5 text-2xl font-black">Connect your wallet</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Your bookings are tied to the connected wallet address.</p>
              </div>
            ) : activeBookings.length === 0 ? (
              <div className="glass flex min-h-[360px] flex-col items-center justify-center rounded-[2rem] p-8 text-center">
                <div className="text-5xl">🏟️</div>
                <h2 className="mt-5 text-2xl font-black">No active games yet</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Book a turf and the reservation will appear here after the Monad transaction confirms.</p>
                <button
                  onClick={() => setTab("book")}
                  className="mt-6 rounded-2xl bg-white px-5 py-3 font-black text-slate-950"
                >
                  Book now
                </button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {activeBookings.map((booking) => {
                  const turf = turfs.find((item) => item.id === Number(booking.turfId)) ?? turfs[0];
                  const isEditing = editingId === booking.id;
                  return (
                    <div key={booking.id.toString()} className="glass rounded-[1.7rem] p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-black">{turf.name}</h3>
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                              #{booking.id.toString()}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-slate-400">{prettyTimestamp(booking.startTime)}</div>
                        </div>
                        <div className="rounded-xl border border-lime-300/20 bg-lime-300/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-lime-200">Active</div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                          <div className="text-[10px] uppercase tracking-wider text-slate-600">Display price</div>
                          <div className="mt-1 font-black">₹{turf.priceInr.toLocaleString("en-IN")}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                          <div className="text-[10px] uppercase tracking-wider text-slate-600">Paid on-chain</div>
                          <div className="mt-1 font-black text-cyan-200">{Number(formatEther(booking.amountPaid)).toFixed(4)} MON</div>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-300/[0.05] p-4">
                          <div className="mb-3 font-bold">Adjust booking</div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              type="date"
                              min={todayString()}
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="rounded-xl border border-white/10 bg-[#101827] px-3 py-2 text-sm outline-none"
                            />
                            <select
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              className="rounded-xl border border-white/10 bg-[#101827] px-3 py-2 text-sm outline-none"
                            >
                              {timeSlots.map((time) => <option key={time} value={time}>{time}</option>)}
                            </select>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => saveEdit(booking)}
                              disabled={pendingAction !== null}
                              className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
                            >
                              {pendingAction === `adjust-${booking.id}` ? "Confirming…" : "Save on-chain"}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-400"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 flex gap-2">
                          <button
                            onClick={() => startEdit(booking)}
                            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold hover:bg-white/[0.08]"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => cancelBooking(booking.id)}
                            disabled={pendingAction !== null}
                            className="flex-1 rounded-xl border border-red-300/15 bg-red-300/[0.04] px-4 py-2.5 text-sm font-bold text-red-200 hover:bg-red-300/[0.08] disabled:opacity-40"
                          >
                            {pendingAction === `cancel-${booking.id}` ? "Confirming…" : "Cancel"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {cancelledBookings.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-600">Cancelled history</h2>
                <div className="space-y-2">
                  {cancelledBookings.slice(0, 8).map((booking) => {
                    const turf = turfs.find((item) => item.id === Number(booking.turfId)) ?? turfs[0];
                    return (
                      <div
                        key={booking.id.toString()}
                        className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-slate-600"
                      >
                        <span>#{booking.id.toString()} • {turf.name} • {prettyTimestamp(booking.startTime)}</span>
                        <span>Cancelled</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "board" && (
          <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
            <div className="space-y-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-300">Stay in the loop</div>
                <h1 className="mt-2 text-3xl font-black tracking-tight">Notice board</h1>
              </div>

              <div className="space-y-4">
                {notices.map((notice) => (
                  <article key={notice.title} className="glass rounded-[1.6rem] p-5 transition hover:border-white/25">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">{notice.tag}</div>
                    <h2 className="mt-2 text-lg font-black">{notice.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{notice.body}</p>
                  </article>
                ))}
              </div>

              <div className="glass rounded-[1.6rem] p-5">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Contact</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="font-black">Venue support</div>
                    <div className="mt-1 text-sm text-slate-500">+91 90000 00000</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="font-black">Workshop demo desk</div>
                    <div className="mt-1 text-sm text-slate-500">help@playslot.demo</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass rounded-[2rem] p-6">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-lime-300">Before you play</div>
                <h2 className="mt-2 text-2xl font-black">Rules & regulations</h2>
                <div className="mt-5 space-y-3">
                  {rules.map((rule, index) => (
                    <div key={rule} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-xs font-black text-slate-400">{index + 1}</span>
                      <span className="pt-1 text-sm leading-5 text-slate-400">{rule}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-[2rem] p-6">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Why Web3 here?</div>
                <h2 className="mt-2 text-xl font-black">Put trust-sensitive actions on-chain.</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Reservation state, conflict prevention, payments, rescheduling and refunds are handled by the Solidity contract. Notices, rules, amenities and contact details stay in the normal application layer.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ["On-chain", "Booking + payment"],
                    ["On-chain", "Adjust + cancel"],
                    ["Off-chain", "Notices + rules"],
                    ["Off-chain", "Venue info"],
                  ].map(([tag, value], index) => (
                    <div key={`${tag}-${value}`} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                      <div className={`text-[10px] font-black uppercase tracking-wider ${index < 2 ? "text-cyan-300" : "text-slate-600"}`}>{tag}</div>
                      <div className="mt-1 text-sm font-bold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <footer className="border-t border-white/8 px-5 py-8 text-center text-xs text-slate-700">
        PlaySlot workshop prototype • Monad Testnet • Test MON only
      </footer>
    </main>
  );
}
