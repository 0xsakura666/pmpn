import { http, createConfig } from "wagmi";
import { polygon } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// 仅使用 Injected（浏览器扩展），无需 WalletConnect/Reown Project ID
// 支持：Rainbow 扩展、MetaMask、Rabby 等
export const config = createConfig({
  chains: [polygon],
  connectors: [injected()],
  transports: {
    [polygon.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
