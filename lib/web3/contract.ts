import type { Address } from "viem";

export const contractAddress =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "") as Address;

export const walletEnabled =
  process.env.NEXT_PUBLIC_WALLET_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);

export const playSlotAbi = [
  { type: "error", name: "InvalidTurf", inputs: [] },
  { type: "error", name: "InvalidStartTime", inputs: [] },
  { type: "error", name: "SlotAlreadyBooked", inputs: [] },
  { type: "error", name: "WrongPayment", inputs: [] },
  { type: "error", name: "NotBookingOwner", inputs: [] },
  { type: "error", name: "BookingNotActive", inputs: [] },
  { type: "error", name: "InvalidBookingCount", inputs: [] },
  { type: "error", name: "TransferFailed", inputs: [] },
  {
    type: "function",
    name: "pricePerSlot",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint8" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "bookSlots",
    stateMutability: "payable",
    inputs: [
      { name: "turfId", type: "uint8" },
      { name: "startTimes", type: "uint64[]" },
    ],
    outputs: [{ name: "createdIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "bookRecurring",
    stateMutability: "payable",
    inputs: [
      { name: "turfId", type: "uint8" },
      { name: "firstStartTime", type: "uint64" },
      { name: "intervalDays", type: "uint16" },
      { name: "count", type: "uint8" },
    ],
    outputs: [{ name: "createdIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "bookRecurringSlots",
    stateMutability: "payable",
    inputs: [
      { name: "turfId", type: "uint8" },
      { name: "firstStartTimes", type: "uint64[]" },
      { name: "intervalDays", type: "uint16" },
      { name: "count", type: "uint8" },
    ],
    outputs: [{ name: "createdIds", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "adjustBooking",
    stateMutability: "payable",
    inputs: [
      { name: "bookingId", type: "uint256" },
      { name: "newTurfId", type: "uint8" },
      { name: "newStartTime", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelBooking",
    stateMutability: "nonpayable",
    inputs: [{ name: "bookingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isSlotAvailable",
    stateMutability: "view",
    inputs: [
      { name: "turfId", type: "uint8" },
      { name: "startTime", type: "uint64" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getCustomerBookings",
    stateMutability: "view",
    inputs: [{ name: "customer", type: "address" }],
    outputs: [
      {
        name: "result",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "customer", type: "address" },
          { name: "turfId", type: "uint8" },
          { name: "startTime", type: "uint64" },
          { name: "amountPaid", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
] as const;
