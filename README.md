# Tectonic - Polymarket Trading Platform

A professional prediction market trading platform for Polymarket with client-side wallet signing, real-time charts, and smart money tracking.

## Features

- **Client-Side Trading**: Users connect their own wallets and sign transactions directly
- **Real-time K-line Charts**: TradingView Lightweight Charts with multiple timeframes
- **Quick Trading Panel**: Market/Limit orders with Polymarket CLOB integration
- **Positions & Orders**: View positions, open orders, and cancel orders
- **Smart Money Tracking**: Track whale wallets with Whale Score system (0-100)
- **Copy Trading**: Follow and copy trades from top traders
- **Live Signal Feed**: Real-time whale activity notifications
- **Market Heatmap**: Visual overview of market performance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
├─────────────────────────────────────────────────────────────┤
│  User Wallet (MetaMask/Rainbow/Rabby)                       │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │ Connect     │───▶│ Sign EIP-712 │───▶│ API Credentials│  │
│  │ Wallet      │    │ Auth Message │    │ (localStorage) │  │
│  └─────────────┘    └──────────────┘    └────────────────┘  │
│                                                │             │
│                                                ▼             │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │ Place Order │───▶│ Sign EIP-712 │───▶│ Submit to CLOB │  │
│  │             │    │ Order        │    │                │  │
│  └─────────────┘    └──────────────┘    └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Polymarket CLOB │
                    │ (clob.polymarket.com)
                    └─────────────────┘
```

**Key Points:**
- No server-side private keys required
- Users sign all transactions with their own wallets
- API credentials derived from wallet signature, stored in localStorage
- Similar architecture to insiders.bot

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Charts**: TradingView Lightweight Charts
- **State**: Zustand, React Query
- **Wallet**: Wagmi, Viem
- **Polymarket**: Custom client-side SDK integration
- **Database**: Neon PostgreSQL, Drizzle ORM
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Neon PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your credentials
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth
AUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000

# Polymarket API
POLYMARKET_API_URL=https://clob.polymarket.com

# WebSocket
NEXT_PUBLIC_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market

# Wallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-reown-project-id
```

### Database Setup

```bash
# Generate migrations
npm run db:generate

# Push schema to database
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes (server-side)
│   │   ├── markets/         # Market data
│   │   ├── positions/       # User positions
│   │   └── signals/         # Whale signals
│   ├── markets/
│   │   └── [id]/            # Market detail page
│   └── smart-money/         # Smart money tracker
├── components/
│   ├── auth/
│   │   └── ConnectWallet.tsx
│   ├── charts/
│   │   └── CandlestickChart.tsx
│   ├── trading/
│   │   ├── QuickTradePanel.tsx   # Trading UI with auth
│   │   ├── PositionsPanel.tsx    # Positions & orders
│   │   ├── PolymarketAuth.tsx    # Auth component
│   │   └── OrderBook.tsx
│   └── ui/
├── hooks/
│   ├── usePolymarket.ts     # Polymarket auth & trading hooks
│   └── useWebSocket.ts
└── lib/
    ├── polymarket.ts        # Public API (markets, orderbook)
    ├── polymarket-client.ts # Client-side auth service
    ├── polymarket-order.ts  # Order signing logic
    └── wagmi.ts             # Wallet configuration
```

## Polymarket Integration

### React Hooks

```tsx
import { 
  usePolymarket,           // Auth state
  usePolymarketPositions,  // User positions
  usePolymarketOrders,     // Open orders
  usePolymarketTrade       // Place orders
} from "@/hooks/usePolymarket";

function TradingComponent() {
  const { isAuthenticated, authenticate } = usePolymarket();
  const { positions } = usePolymarketPositions();
  const { orders, cancelOrder } = usePolymarketOrders();
  const { placeOrder, isSubmitting } = usePolymarketTrade();

  const handleBuy = async () => {
    const result = await placeOrder({
      tokenId: "TOKEN_ID",
      price: 0.5,
      size: 10,
      side: "BUY",
      tickSize: "0.01",
    });
  };

  return (
    <div>
      {!isAuthenticated ? (
        <button onClick={authenticate}>Sign to Authenticate</button>
      ) : (
        <button onClick={handleBuy}>Buy</button>
      )}
    </div>
  );
}
```

### Components

```tsx
import { QuickTradePanel } from "@/components/trading/QuickTradePanel";
import { PositionsPanel } from "@/components/trading/PositionsPanel";
import { PolymarketAuth } from "@/components/trading/PolymarketAuth";

// Full trading panel with auth
<QuickTradePanel
  marketTitle="Will X happen?"
  yesPrice={0.65}
  noPrice={0.35}
  yesTokenId="..."
  noTokenId="..."
  tickSize="0.01"
/>

// Positions and orders
<PositionsPanel />

// Auth-only component
<PolymarketAuth />
```

## User Flow

1. **Connect Wallet** - Click "Connect Wallet" to connect MetaMask/Rainbow/Rabby
2. **Authenticate** - Sign EIP-712 message to derive Polymarket API credentials
3. **View Positions** - See your current positions and P&L
4. **Place Orders** - Select Yes/No, enter amount, sign order, submit
5. **Manage Orders** - View open orders, cancel individual or all orders

## API Reference

### Public Endpoints (No Auth)

| Endpoint | Description |
|----------|-------------|
| `GET /api/markets` | List all markets |
| `GET /api/markets/[id]` | Get market details |
| `GET /api/positions?user=0x...` | Get user positions |

### Smart Money

| Endpoint | Description |
|----------|-------------|
| `GET /api/smart-money` | Get top traders |
| `GET /api/signals` | Get whale signals |
| `GET /api/whale/leaderboard` | Whale leaderboard |

## Deployment

### Vercel

1. Connect repository to Vercel
2. Add environment variables
3. Deploy

### Database (Neon)

1. Create project at [neon.tech](https://neon.tech)
2. Copy connection string to `DATABASE_URL`
3. Run `npm run db:push`

## License

MIT
