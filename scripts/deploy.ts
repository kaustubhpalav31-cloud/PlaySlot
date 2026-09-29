import { network } from "hardhat";

const { viem } = await network.connect();
const contract = await viem.deployContract("PlaySlotBooking");

console.log("");
console.log("PlaySlotBooking deployed successfully.");
console.log("Contract address:", contract.address);
console.log("");
console.log("Copy this address into .env.local as:");
console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contract.address}`);
