# PlaySlot

**PlaySlot** is a Web3 sports turf booking and coordination prototype built for a blockchain workshop.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Solidity
- Hardhat
- wagmi
- viem

## Product idea

Users can browse turfs, book one or multiple slots, make recurring weekly reservations, adjust bookings, cancel bookings, view payment summaries, read notices and rules, and access contact information.

The on-chain layer is responsible for trust-sensitive actions:
- reservation state;
- conflict prevention;
- wallet-linked bookings;
- payments;
- booking adjustments;
- cancellations and refunds.

The informational layer remains off-chain:
- notice board;
- rules;
- contacts;
- amenities;
- turf descriptions.

## Safety-first default

Wallet interaction is OFF by default.

See `START_HERE.md` before running the project.

## Workshop MVP

Demo Mode lets the entire user experience run without MetaMask. When you are ready, deploy `contracts/PlaySlotBooking.sol` to the local Hardhat node and enable wallet mode in `.env.local`.

## No real-money requirement

Use local Hardhat test ETH only for workshop demonstrations. The INR values shown in the UI are product-facing demo prices; the contract uses tiny test-ETH values solely to demonstrate payable smart-contract interactions.
