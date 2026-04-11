import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { polygon } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";
const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
const appUrl =
  runtimeOrigin ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://pmpn-one.vercel.app");

export const config = getDefaultConfig({
  appName: "Tectonic",
  appDescription: "Polymarket trading platform with wallet-based authentication",
  appUrl,
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
