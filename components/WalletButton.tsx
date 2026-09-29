"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { walletEnabled } from "@/lib/web3/contract";
import { monadTestnet } from "@/lib/web3/config";

export default function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  if (!walletEnabled) {
    return (
      <button
        disabled
        className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-200 opacity-90"
      >
        🔒 Wallet Locked
      </button>
    );
  }

  if (isConnected && chainId !== monadTestnet.id) {
    return (
      <button
        onClick={() => switchChain({ chainId: monadTestnet.id })}
        disabled={isSwitching}
        className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100"
      >
        {isSwitching ? "Switching…" : "Switch to Monad"}
      </button>
    );
  }

  if (isConnected) {
    return (
      <button
        onClick={() => disconnect()}
        title="Click to disconnect"
        className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100"
      >
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </button>
    );
  }

  return (
    <button
      disabled={isPending || connectors.length === 0}
      onClick={() => connectors[0] && connect({ connector: connectors[0] })}
      className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:scale-[1.02] disabled:opacity-50"
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
