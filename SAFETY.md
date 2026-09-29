# Safety Notes

This repository is deliberately conservative.

## It does NOT
- install packages globally;
- request administrator access;
- modify Windows settings;
- alter registry values;
- touch drivers;
- touch BIOS/UEFI;
- access files outside the project;
- connect to MetaMask automatically;
- send a blockchain transaction automatically;
- use a real private key in source code.

## Wallet gating

Wallet interaction requires BOTH:
1. `NEXT_PUBLIC_WALLET_ENABLED=true`
2. a deployed contract address in `NEXT_PUBLIC_CONTRACT_ADDRESS`

The default `.env.example` keeps wallet access disabled.

## Important

Never put a real wallet seed phrase or private key anywhere in this project.

For the workshop, use a separate test account and local Hardhat test funds.
