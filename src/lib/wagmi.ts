import { http, createConfig } from "wagmi";
import { polygon } from "wagmi/chains";
import { injected, metaMask, coinbaseWallet, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export const config = createConfig({
  chains: [polygon],
  connectors: [
    metaMask(),
    coinbaseWallet({
      appName: "Tectonic",
    }),
    ...(projectId ? [walletConnect({ projectId })] : []),
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [polygon.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
