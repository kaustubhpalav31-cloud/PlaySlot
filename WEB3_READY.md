# Web3 Integration Status

The project already contains the required Web3 stack:

- Solidity contract: `contracts/PlaySlotBooking.sol`
- Hardhat config: `hardhat.config.ts`
- Hardhat deployment script: `scripts/deploy.ts`
- wagmi provider/config: `app/providers.tsx`, `lib/web3/config.ts`
- viem chain definition + ABI: `lib/web3/config.ts`, `lib/web3/contract.ts`
- MetaMask/injected wallet button: `components/WalletButton.tsx`

## Contract functions already implemented

- `bookSlots(...)`
  - One or multiple hours in one transaction.
  - Entire transaction reverts if any selected slot conflicts.

- `bookRecurring(...)`
  - One selected hour repeated every N days.

- `bookRecurringSlots(...)`
  - Multiple selected hours repeated every N days.
  - Example: 6–7 PM and 7–8 PM every Saturday for four weeks.

- `adjustBooking(...)`
  - Moves a booking to another available turf/time.
  - Collects an exact additional payment if the new turf is more expensive.
  - Refunds the difference if the new turf is cheaper.

- `cancelBooking(...)`
  - Releases the slot.
  - Applies the demo time-based refund rule.

- `isSlotAvailable(...)`
  - Frontend availability check.

- `getCustomerBookings(...)`
  - Reads wallet-linked booking history.

## Why the UI currently uses Demo Mode

`NEXT_PUBLIC_WALLET_ENABLED=false` is intentional.

This prevents the workshop prototype from asking your browser wallet for permission before you have decided which MetaMask account/profile to use.

The UI therefore uses local browser storage for the first demo while the same business flows are represented in Solidity.

## Before enabling real wallet calls

Do not flip the flag casually.

First:
1. Start the local Hardhat node.
2. Deploy the contract.
3. Put the deployed address in `.env.local`.
4. Create/select a workshop-only test wallet/account.
5. Add the Hardhat local network to MetaMask.
6. Fund only that test account with Hardhat test ETH.
7. Then enable `NEXT_PUBLIC_WALLET_ENABLED=true`.

The current safe package deliberately stops before step 5 so your existing CineBook wallet setup is not affected.
