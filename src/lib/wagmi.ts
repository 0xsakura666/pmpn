import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { polygon } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

export const config = getDefaultConfig({
  appName: "Tectonic",
  appDescription: "Polymarket trading platform with wallet-based authentication",
  appUrl: "https://pmpn-one.vercel.app",
  projectId,
  chains: [polygon],
  transports: {
    [polygon.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
