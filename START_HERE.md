# PlaySlot — START HERE

This project is intentionally configured for **safe workshop development**.

## Important safety status

- MetaMask / wallet connection is **OFF by default**.
- No command in this project changes Windows system settings.
- No administrator access is required.
- No registry, drivers, BIOS, kernel, services, or system configuration are touched.
- No real ETH is required.
- The UI works first in **Demo Mode** using browser `localStorage`.
- The smart contract and wallet code are already included for later activation.

## What is installed on your laptop?

You already have Node.js and npm.

When you run:

```cmd
npm install
```

npm downloads project libraries into:

```text
PlaySlot\node_modules\
```

This is the Node.js equivalent of project-local dependency isolation. It is NOT a Python `venv`, but the dependencies stay inside this project folder.

Nothing is globally installed by the setup instructions below.

## First run — SAFE DEMO MODE

1. Extract the ZIP.
2. Open the **PlaySlot** folder in VS Code.
3. Open the VS Code terminal.
4. Run:

```cmd
npm install
```

5. Copy `.env.example` to `.env.local`.

On Windows CMD:

```cmd
copy .env.example .env.local
```

6. Keep this line exactly as:

```text
NEXT_PUBLIC_WALLET_ENABLED=false
```

7. Start the app:

```cmd
npm run dev
```

8. Open:

```text
http://localhost:3000
```

At this stage:
- the full UI works;
- demo bookings work;
- multiple slot booking works;
- recurring booking works;
- booking adjustment works;
- cancellation works;
- payment summaries are simulated;
- wallet/MetaMask is NOT requested.

## Safe stop

In the terminal where the app is running:

```text
Ctrl + C
```

If Windows asks `Terminate batch job (Y/N)?`, press:

```text
Y
```

## Contract preparation — still no MetaMask

Only do this when you are ready to test the blockchain layer.

Terminal 1:

```cmd
npm run contract:compile
npm run contract:node
```

Keep Terminal 1 open.

Terminal 2:

```cmd
npm run contract:deploy
```

The deploy command prints a contract address.

Copy that address into `.env.local`:

```text
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

You can still leave:

```text
NEXT_PUBLIC_WALLET_ENABLED=false
```

This means the contract exists locally but the website still cannot ask MetaMask to connect.

## MetaMask step — DO NOT DO THIS YET

The project is ready for wallet integration, but it is intentionally locked.

Before enabling the wallet:
1. Decide whether to create a fresh workshop-only MetaMask account/profile.
2. Confirm the local network details.
3. Confirm that you are not reusing the college CineBook account by mistake.
4. Then change:

```text
NEXT_PUBLIC_WALLET_ENABLED=true
```

Do this only when you intentionally want to connect.

## Main features included

- Stylish workshop-friendly Next.js interface
- Turf discovery cards
- Multiple turf options
- Date selection
- Multiple time-slot booking
- Weekly recurring / long-term booking
- Booking price summary
- Demo test-ETH equivalent
- My Bookings
- Modify / reschedule booking
- Cancellation
- Notice board
- Rules and regulations
- Contact information
- Amenities
- Solidity smart contract
- Conflict prevention
- Multi-booking on-chain function
- Recurring booking on-chain function
- Adjustment on-chain function
- Cancellation + refund policy
- wagmi wallet layer
- viem EVM layer
- Hardhat local chain setup

## Suggested workshop demo order

1. Show Home / turf choices.
2. Open Book.
3. Choose a date.
4. Select two slots.
5. Show payment summary.
6. Confirm in Demo Mode.
7. Open My Bookings.
8. Modify one booking.
9. Cancel another booking.
10. Show recurring weekly booking.
11. Explain that booking/payment state moves on-chain once wallet mode is enabled.

This lets you demonstrate the complete product even before touching MetaMask.
