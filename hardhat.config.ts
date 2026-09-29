import { configVariable, defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

export default defineConfig({
  plugins: [hardhatToolboxViem],

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    monadTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://testnet-rpc.monad.xyz",
      accounts: [configVariable("MONAD_PRIVATE_KEY")],
    },
  },
});