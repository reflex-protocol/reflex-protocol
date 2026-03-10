import { defineChain } from "viem";
import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { injected } from "wagmi/connectors";

export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: {
    name: "Somnia Test Token",
    symbol: "STT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://dream-rpc.somnia.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Shannon Explorer",
      url: "https://shannon-explorer.somnia.network",
    },
  },
  testnet: true,
});

export const config = createConfig({
  chains: [somniaTestnet],
  connectors: [
    injected(),
  ],
  transports: {
    [somniaTestnet.id]: http(),
  },
  ssr: true,
  // Persist wallet connection across page navigations using cookies
  // so SSR can hydrate the correct connection state.
  storage: createStorage({
    storage: cookieStorage,
  }),
});
