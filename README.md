# NFEGlobal Hub — Full Technical Documentation

> **Full-stack decentralized mining & referral protocol** running on BNB Smart Chain.
> A mobile-first Web3 mini-app with a Telegram-native feel, on-chain income streaming, and a viral free-to-play growth engine.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Smart Contracts](#3-smart-contracts)
4. [Backend API Server](#4-backend-api-server)
5. [Frontend Application](#5-frontend-application)
6. [Database Schema](#6-database-schema)
7. [Environment Variables](#7-environment-variables)
8. [Deployment Guide](#8-deployment-guide)
9. [API Reference](#9-api-reference)
10. [Income Distribution Logic](#10-income-distribution-logic)
11. [Key Features Reference](#11-key-features-reference)

---

## 1. Project Overview

NFEGlobal Hub is a **decentralized node protocol** where every user becomes an earning node. The platform distributes BNB automatically via three smart contract income streams:

| Stream | Description |
|---|---|
| **Direct / Referral** | 10% paid to your immediate sponsor on every new node activation and tier upgrade |
| **Layer Income** | Distributed across 17 upline layers (1.5% → 1% → 0.35% per layer) |
| **Matrix Income** | 70% of every activation routed through a binary BFS matrix to your upline receivers |
| **Global Pool** | 5% of every payment goes to the RewardPool contract, distributed to qualified nodes |

### Contract Addresses (BSC Mainnet)

| Contract | Address |
|---|---|
| **NFEGlobal** | `0xaECA2Bb1b42DeA8F937c51f41A512C59dDd46a2d` |
| **nfeglobalViews** | `0xcd6eE0B87e12BaB1942EDB56f9E7272078229A04` |
| **RewardPool** | `0x4A91Fe2ac61D93eF3909916aafDb3bc85e6697CD` |

### Contract Addresses (BSC Testnet)

| Contract | Address |
|---|---|
| **NFEGlobal** | `0x8078E36DCd2049526b799F779B8B48464fDcFEd7` |
| **nfeglobalViews** | `0x7a02d73C612d86d3C804d4819E24b6C5c5855794` |
| **RewardPool** | `0xf3693161d1DD31e84991F7367325Deae8CC47A76` |

**Genesis Node ID:** `55555` (root of the entire referral and matrix tree)

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    NFEGLOBAL HUB STACK                     │
│                                                          │
│  ┌─────────────────┐   ┌────────────────────────────┐   │
│  │   React + Vite  │   │    BNB Smart Chain          │   │
│  │   (Frontend)    │◄──┤  NFEGlobal.sol                │   │
│  │   Port 80/443   │   │  nfeglobalViews.sol               │   │
│  │   nginx reverse │   │  RewardPool.sol             │   │
│  │   proxy         │   │  BNBPriceOracle.sol         │   │
│  └────────┬────────┘   └────────────────────────────┘   │
│           │                                              │
│  ┌────────▼────────┐   ┌────────────────────────────┐   │
│  │  Express.js API │   │   PostgreSQL 16             │   │
│  │  (Node.js)      │◄──┤   Database                  │   │
│  │  Port 3001      │   │   - users table             │   │
│  │  + Chain Poller │   │   - income_history table    │   │
│  └─────────────────┘   │   - tasks table             │   │
│                         └────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Docker Services:**
- `nfeglobal-frontend` — Vite build served by Nginx (port 80/443 with SSL)
- `nfeglobal-api` — Express.js REST API + blockchain poller (port 3001)
- `nfeglobal-db` — PostgreSQL 16 with persistent volume
- `certbot` — Auto Let's Encrypt SSL renewal

---

## 3. Smart Contracts

### 3.1 NFEGlobal.sol — Core Protocol

The main contract. All BNB flows through this contract and is distributed automatically.

#### Key Constants

| Constant | Value | Description |
|---|---|---|
| `defaultRefer` | `55555` | Genesis node — root of tree |
| `directPercent` | `10%` | Sponsor gets 10% of every payment |
| `cyclicPercent` | `70%` | Matrix binary tree income |
| `rewardPoolPercent` | `5%` | Global reward pool allocation |
| `layerDepth` | `17` | Upline layers for layer income |
| `minDirectNodes` | `2` | Required direct refs for layers 6–17 |

#### Tier Price Table (USD, converted to BNB at oracle rate)

| Tier | Cost (USD) | Tier | Cost (USD) |
|---|---|---|---|
| L0 (Register) | $5 | L10 | $2,560 |
| L1 | $5 | L11 | $5,120 |
| L2 | $10 | L12 | $10,240 |
| L3 | $20 | L13 | $20,480 |
| L4 | $40 | L14 | $40,960 |
| L5 | $80 | L15 | $81,920 |
| L6 | $160 | L16 | $163,840 |
| L7 | $320 | L17 | $327,680 |
| L8 | $640 | | |
| L9 | $1,280 | | |

#### Write Functions

```solidity
// Register a new node (costs L0 tier price in BNB)
function createNode(uint _sponsor) external payable

// Upgrade to higher tier (must be sequential)
function unlockTier(uint _nodeId, uint _toTier) external payable

// Pull any failed BNB transfers (pull-payment pattern)
function withdraw() external
```

#### Read Functions

```solidity
function getIncome(uint _nodeId, uint _length) view returns (RewardEvent[])
function getMissedIncome(uint _nodeId, uint _length) view returns (RewardEvent[])
function getIncomeByType(uint _nodeId, uint _type, uint _length) view returns (RewardEvent[])
function getIncomeBreakdown(uint _nodeId) view returns (uint total, uint referral, uint tier, uint binary, uint direct, uint lost, uint poolIncome)
function getNodeStats(uint _userId) view returns (uint tier, uint directCount, uint matrixCount, uint totalRewards, uint totalContribution, uint daysActive)
function getTierCost(uint _index) view returns (uint)
function getTierCosts() view returns (uint[18])
function bnbPrice() view returns (uint)   // 8-decimal USD, e.g. 60000000000 = $600
function nodeId(address user) view returns (uint)
function isNodeActive(uint userId) view returns (bool)
function isNodeRegistered(address node) view returns (bool)
function pendingReward(address user) view returns (uint)
```

#### Events

```solidity
// Emitted on node creation
event NodeCreated(address indexed node, uint indexed userId, uint indexed referrerId, uint uplineId)

// Emitted on tier unlock
event TierUnlocked(address indexed node, uint indexed userId, uint packageId)

// Emitted on every reward distribution (received AND missed)
event RewardDistributed(
    address indexed wallet,   // recipient wallet
    uint indexed nodeId,      // recipient node ID
    uint fromId,              // source node ID
    uint layer,               // layer / level (1-indexed)
    uint amount,              // BNB in wei
    uint time,                // block.timestamp
    bool isMissed,            // true = reward went to fee receiver (not qualified)
    uint rewardType,          // 1=Direct, 2=Layer, 3=Matrix
    uint tier                 // tier that generated this event
)

// Emitted when the price oracle updates
event OraclePriceUpdated(uint newPrice, uint time)
```

#### `RewardEvent` Struct

```solidity
struct RewardEvent {
    uint id;           // from node ID
    uint layer;        // layer/level
    uint amount;       // BNB in wei
    uint time;         // timestamp
    bool isMissed;     // missed = not qualified
    uint rewardType;   // 1=Direct, 2=Layer, 3=Matrix
    uint tier;         // tier index
}
```

#### Income Type Mapping

| `rewardType` | `tier` | Label |
|---|---|---|
| `1` | `0` | **Referral** (new node registration) |
| `1` | `> 0` | **Direct Upgrade** (tier unlock) |
| `2` | any | **Layer Income** |
| `3` | any | **Matrix Income** |

---

### 3.2 nfeglobalViews.sol — Read-Only Helper Library

Pure view functions used by NFEGlobal for complex read operations. Not called directly by users.

Key functions:
- `getIncome(rewardHistory, nodeId, length)` — Paginated income history
- `getMissedIncome(...)` — Only missed (unqualified) events
- `getIncomeByType(...)` — Filter by rewardType
- `getIncomeBreakdown(...)` — Aggregate sums per income type
- `getNodeStats(...)` — Tier, refs, matrix count, totals
- `getTierCosts(bnbPrice, tierPriceUSD)` — All 18 tier costs in BNB

---

### 3.3 RewardPool.sol — Global Reward Pool

Accumulates 5% of all payments and distributes to pools based on qualification criteria (direct refs, tier, team size).

```solidity
// Register node in pool (called once after createNode)
function registerNode(uint nodeId) external

// Claim pool earnings
function claim(uint nodeId) external

// View claimable amount
function getClaimable(uint nodeId) view returns (uint fromCurrentPool, uint fromExitedPools, uint total)

// Full pool info for a node
function getPoolViewHelper(uint nodeId) view returns (
    uint8 currentPoolId,
    string poolName,
    uint256 claimable,
    uint256 totalEarned,
    uint256 totalClaimedAmount,
    uint256 remainingCap,
    uint256 lifetimeCap,
    uint256 totalDeposited,
    uint256 nfeTier,
    bool isQualifiedForNext,
    uint8 nextPoolId,
    uint256[3] missingRequirements  // [directs, tier, team]
)

// Event
event RewardClaimed(uint nodeId, address wallet, uint amount)
```

---

### 3.4 BNBPriceOracle.sol

Implements `AggregatorV3Interface`. Used as a local verification layer for the Chainlink BNB/USD price feed. Validates price freshness, deviation bounds (±20%), and staleness (24h).

---

## 4. Backend API Server

**Location:** `server/index.js`  
**Runtime:** Node.js 18 + Express.js  
**Port:** 3001 (internal Docker network)

### Global Blockchain Poller

Runs every **2 minutes** at startup, fetching the latest 3,000 blocks of `RewardDistributed` events from **all nodes** (no wallet filter). Writes all events to `income_history` table.

```
syncGlobalHistory() → runs every 2 min
syncUserHistory(wallet) → triggered on user wallet connection
```

---

## 5. Frontend Application

**Stack:** React 18 + Vite 5 + Zustand + Wagmi + RainbowKit + Framer Motion

### Directory Structure

```
src/
├── App.jsx                  — Root app, tab routing
├── main.jsx                 — React entry, WagmiProvider setup
├── index.css                — Design system, CSS variables
├── components/
│   ├── TopBar.jsx           — Wallet balance, BNB + USD, refresh button
│   ├── TabBar.jsx           — Bottom navigation tabs
│   ├── LoginScreen.jsx      — Pre-connect landing screen
│   ├── DailyPopup.jsx       — Daily mining streak modal
│   └── NodePopup.jsx        — Node activation CTA modal
├── pages/
│   ├── EarnScreen.jsx       — Mining engine + Income History (MY TEAM / LIVE FEED)
│   ├── DashboardScreen.jsx  — Node stats, pool qualification, BNB totals
│   ├── UpgradeScreen.jsx    — Tier upgrade / node activation
│   ├── TeamScreen.jsx       — Referral network matrix visualizer
│   ├── TaskScreen.jsx       — Gamified referral task progress
│   ├── ReferralScreen.jsx   — Referral code + share links
│   ├── ContractsScreen.jsx  — ABI explorer, raw contract interaction
│   ├── MarketingScreen.jsx  — Marketing landing / onboarding flow
│   └── AdminScreen.jsx      — Admin panel (owner wallet only)
├── hooks/
│   ├── useContract.js       — useContract(), useWalletLifecycle()
│   └── useBnbPrice.js       — Shared on-chain BNB/USD price hook (5-min cache)
├── services/
│   ├── blockchain.js        — BlockchainService class (ethers v6 calls)
│   └── api.js               — REST API client wrapper
├── store/
│   └── gameStore.js         — Zustand global state with persist middleware
├── config/
│   ├── constants.js         — Contract addresses, RPC URLs
│   ├── abi.js               — Frontend ABI definitions (human-readable)
│   └── wagmi.js             — Wagmi + RainbowKit config
└── utils/
    ├── format.js            — formatBNB(), formatNumber(), shortAddr()
    └── ethers-adapter.js    — Ethers v6 Wagmi bridge
```

### State Management (`gameStore.js`)

Powered by **Zustand** with `persist` middleware (localStorage key: `nfeglobal-game-state`).

#### Persisted State (survives refresh)

| Key | Type | Description |
|---|---|---|
| `walletAddress` | `string` | Connected wallet address |
| `isConnected` | `bool` | Wallet connected flag |
| `hasNode` | `bool` | Whether node exists on-chain |
| `nodeId` | `number` | Contract node ID |
| `nodeTier` | `number` | Current tier (1–18) |
| `nodeActive` | `bool` | Is node active? |
| `taps` | `number` | Total tap count |
| `localReward` | `number` | Coin mining balance |
| `referrerId` | `string` | Referrer wallet from URL param |

#### Runtime State (reset on refresh)

| Key | Description |
|---|---|
| `teamHistory` | Income history from on-chain / Postgres |
| `globalHistory` | Network-wide live BNB payout stream |
| `bnbBalance` | Wallet BNB balance (string) |
| `pendingReward` | Unclaimed mining BNB |
| `poolClaimable` | Pool claimable BNB |
| `totalEarned` | Lifetime earnings BNB |
| `isHistoryLoading` | Loading state for history tab |

#### Key Actions

| Action | Description |
|---|---|
| `fetchTeamHistory()` | Load income history: tries on-chain `getIncome()` first, falls back to Postgres |
| `fetchGlobalHistory()` | Load global network payout stream from `/api/history/global` |
| `fetchUserData()` | Sync user from Postgres backend (taps, energy, tier, referrer) |
| `fetchAdminStatus()` | Check if wallet is contract owner |
| `claimMined()` | Claim accumulated coin mining reward |

---

### `BlockchainService` (`blockchain.js`)

Singleton class wrapping Ethers v6 calls. All methods are safe (`.catch(() => null)` pattern).

#### Key Methods

| Method | Description |
|---|---|
| `getFullDashboardData(address)` | 4-source tier waterfall + all dashboard stats |
| `fetchTeamHistoryOnChain(nodeId, 100)` | Reads `getIncome()` directly from contract storage (no block scan, no limits) |
| `_getBnbUsdPrice()` | 3-tier price fetch: on-chain oracle → Binance API → CoinGecko → $600 fallback |
| `createNode(sponsorId)` | Submit `createNode()` tx + auto-register pool |
| `unlockTier(nodeId, toTier)` | Submit `unlockTier()` tx |
| `claimRewards()` | Call `withdraw()` for pending pulls |
| `claimPool(nodeId)` | Call `RewardPool.claim(nodeId)` |
| `getMatrixCounts(nodeId)` | Matrix member counts per layer |

#### BNB Price Fetch Waterfall

```
1. NFEGlobal.bnbPrice() on-chain oracle  (8 decimals, e.g. 60000000000 = $600)
              ↓ (fails)
2. Binance API — BNBUSDT ticker
              ↓ (fails)
3. CoinGecko — binancecoin/usd
              ↓ (fails)
4. Stale cache or $600 default fallback
```

Cache TTL: **5 minutes** (shared across all components via `useBnbPrice` hook)

---

### `useBnbPrice` Hook

Shared singleton hook — only one chain call regardless of how many components mount it:

```jsx
import { useBnbPrice } from '../hooks/useBnbPrice.js';

const bnbPrice = useBnbPrice();
const usdValue = (parseFloat(bnbAmount) * bnbPrice).toFixed(2);
```

---

### BNB + USD Display — All App Locations

Every BNB value in the app shows both BNB and blue (`#4FC3F7`) dollar equivalent:

| Location | Example |
|---|---|
| **TopBar** wallet balance | `0.2400 BNB` / `≈ $144.00` |
| **Dashboard** Total Earnings | `1.2340 BNB` / `≈ $740.40` |
| **Dashboard** Unclaimed Mining | `0.0012 BNB` / `≈ $0.72` |
| **Dashboard** Pool Rewards | `0.3400 BNB` / `≈ $204.00` |
| **Dashboard** Total Protocol Volume | `2841 BNB` / `≈ $1,704,600` |
| **Upgrade** activation CTA | `0.050 BNB ≈ $30.00 USD` |
| **Upgrade** next tier cost | `0.050 BNB` / `≈ $30.00` |
| **Upgrade** locked tier grid | `0.100 BNB` / `≈ $60.00` |
| **Earn History** income cards | `+0.00250 BNB` / `≈ $1.50` |

---

## 6. Database Schema

**Database:** PostgreSQL 16  
**Connection:** `server/db.js` → `server/init.sql`

### `users` Table

```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    wallet_address  VARCHAR(42) UNIQUE NOT NULL,
    referrer_id     INTEGER REFERENCES users(id),    -- Free user referrer bond
    taps            INTEGER DEFAULT 0,
    energy          INTEGER DEFAULT 500,
    local_reward    NUMERIC(20,4) DEFAULT 0,
    node_tier       INTEGER DEFAULT 0,
    is_premium      BOOLEAN DEFAULT false,
    last_claim_time TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

### `income_history` Table

```sql
CREATE TABLE income_history (
    id              SERIAL PRIMARY KEY,
    wallet_address  VARCHAR(42) NOT NULL,
    source_contract VARCHAR(42),
    event_type      VARCHAR(50),    -- 'Referral', 'Layer Income', 'Matrix Income', 'Global Pool'
    from_node_id    INTEGER,        -- source node that triggered this distribution
    amount_bnb      NUMERIC(30,18),
    amount_usd      NUMERIC(20,4),
    tier            INTEGER DEFAULT 0,
    layer           INTEGER DEFAULT 0,
    is_missed       BOOLEAN DEFAULT false,
    tx_hash         VARCHAR(66) UNIQUE,    -- ON CONFLICT DO NOTHING key
    timestamp       TIMESTAMP NOT NULL
);
```

### `tasks` Table

```sql
CREATE TABLE tasks (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200),
    reward      NUMERIC(20,4),
    is_completed BOOLEAN DEFAULT false,
    wallet_address VARCHAR(42)
);
```

---

## 7. Environment Variables

Copy `.env.example` → `.env`:

```env
# WalletConnect Cloud Project ID
# Get free at cloud.walletconnect.com
VITE_PROJECT_ID=your_project_id_here

# BSC Mainnet RPC (use paid node in production for best performance)
VITE_BSC_MAINNET_RPC=https://bsc-dataseed.binance.org

# Backend API base (proxied by nginx in prod)
VITE_API_URL=/api

# Admin wallet address (grants access to AdminScreen)
VITE_ADMIN_WALLET=0xYourAdminWalletAddress
```

**Server environment** (set in `docker-compose.yml`):

```env
PORT=3001
DB_HOST=db
DB_USER=postgres
DB_PASSWORD=nfeglobal_pass
DB_NAME=nfeglobal_game
```

---

## 8. Deployment Guide

### Prerequisites

- Ubuntu 22.04 VPS (recommended: 2 vCPU, 4GB RAM, 40GB SSD)
- Docker + Docker Compose installed
- Domain name pointed to server IP
- Port 80 and 443 open in firewall

### Initial Setup (First Time)

```bash
# 1. SSH into server
ssh root@your-server-ip

# 2. Clone the repository
git clone https://github.com/quevitsolutions/nfeglobalhub ~/nfeglobal
cd ~/nfeglobal

# 3. Copy and fill environment variables
cp .env.example .env
nano .env   # fill in VITE_PROJECT_ID and VITE_ADMIN_WALLET

# 4. Get SSL certificate (replace domain)
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot -d yourdomain.com --email you@email.com --agree-tos

# 5. Build and start all services
docker compose up -d --build

# 6. Check status
docker compose ps
docker compose logs api
```

### Updating (Every Code Push)

```bash
cd ~/nfeglobal
git pull origin main
docker compose up -d --build
```

### Useful Commands

```bash
# View live API logs
docker compose logs -f api

# View frontend logs
docker compose logs -f app

# Check database
docker compose exec db psql -U postgres -d nfeglobal_game

# Restart specific service
docker compose restart api

# Stop everything
docker compose down

# Nuclear reset (wipes DB volume!)
docker compose down -v
```

### Health Check

```
GET https://yourdomain.com/api/health
→ "API is healthy"
```

---

## 9. API Reference

Base URL: `https://yourdomain.com/api` (proxied by nginx)

### User Endpoints

#### `GET /api/user/:walletAddress`
Fetch or create user record. Pass `?ref=0xSPONSOR_WALLET` to bind referrer on creation.

**Response:**
```json
{
  "id": 1,
  "wallet_address": "0x...",
  "referrer_id": 2,
  "taps": 1500,
  "energy": 320,
  "local_reward": 42000,
  "node_tier": 3,
  "is_premium": false,
  "pending_mined": 12.5,
  "direct_refs": 5,
  "team_size": 47
}
```

#### `POST /api/sync`
Sync tap/energy/tier state from client.

**Body:** `{ walletAddress, taps, energy, nodeTier }`

#### `GET /api/user/income-history/:walletAddress`
Fetch income history from `income_history` table for a specific wallet.

#### `POST /api/user/:walletAddress/claim`
Claim accumulated mined coins.

---

### History Endpoints

#### `GET /api/history/global`
Returns last 100 BNB distributions across **all nodes** (anonymized wallet). Used for the Live Feed tab.

**Response:**
```json
[
  {
    "wallet_address": "0x1234...5678",
    "event_type": "Layer Income",
    "amount_bnb": "0.002500000000000000",
    "amount_usd": "1.50",
    "tier": 2,
    "from_node_id": 37045,
    "is_missed": false,
    "timestamp": "2026-04-12T05:20:00.000Z"
  }
]
```

---

### Task Endpoints

#### `GET /api/tasks/:walletAddress`
Fetch gamified referral task list and completion status.

#### `POST /api/tasks/:walletAddress/claim/:taskId`
Claim task reward.

---

### Admin Endpoints (owner wallet only)

#### `GET /api/admin/overview/:walletAddress`
Global platform stats.

#### `GET /api/admin/user/:walletAddress`
Full user data.

#### `POST /api/admin/adjust-reward`
Manual reward adjustment.

#### `POST /api/admin/snapshot`
Create database snapshot.

---

## 10. Income Distribution Logic

### On Every `createNode()` call:

```
Payment = getTierCost(0) BNB

1. Direct (10%) → Sponsor wallet
2. Layer (17 levels) → Upline chain
   - L1–L5: 1.5% each (no minimum directs required)
   - L6–L10: 1.0% each (need ≥ 2 direct refs)
   - L11–L17: 0.35% each (need ≥ 2 direct refs)
3. Matrix (70%) → Binary BFS tree receiver
4. Pool (5%) → RewardPool contract

MISSED rule: If upline node's tier ≤ current tier, reward goes to feeReceiver
```

### On Every `unlockTier()` call:

Same distribution as `createNode()` — per tier unlocked.

### Income History Reading

```
Primary: NFEGlobal.getIncome(nodeId, 100)
   → Reads directly from rewardHistory[nodeId] storage
   → No block range scan, works for any node including #55555
   → Returns full RewardEvent[] including amount, tier, layer, isMissed

Fallback: PostgreSQL income_history table
   → Populated by the backend event poller
   → Used when on-chain call fails or returns empty
```

---

## 11. Key Features Reference

### Free-to-Play Viral Growth
- Users without a node join as **Free Operatives** (30-day trial window)
- Earn 10 coins/hr free mining (vs 100–200/hr for active nodes)
- Referred via URL: `https://app.nfeglobal.com/?ref=SPONSOR_WALLET`
- Referrer stored in Postgres at account creation via `referrer_id`

### Task Page (Gamified Referral Milestones)
- Tasks parsed with regex (e.g. `"Invite 100 Peers"` → target = 100)
- Progress bar: `current_direct_refs / target`
- Claim button locked until threshold met

### Income History — 2-Mode View
| Mode | Source | Show |
|---|---|---|
| **MY TEAM** | On-chain `getIncome()` + DB fallback | Only your node's income |
| **LIVE FEED 🌍** | `/api/history/global` | All 100 latest network payouts |

### Wallet Persistence
- Zustand `persist` stores wallet/node state to `localStorage`
- On page refresh: Wagmi auto-reconnects → lifecycle hook loads node data → income history loads automatically — **no manual reconnect needed**

### BNB Price Oracle Chain
```
NFEGlobal.bnbPrice() (8 decimals)
→ / 1e8 = USD price
→ Cached 5 minutes in BlockchainService._bnbPrice
→ Shared to all UI via useBnbPrice() hook
→ All BNB amounts × price = blue $ equivalent displayed everywhere
```

---

## Quick Reference: Common Fixes

| Problem | Cause | Fix |
|---|---|---|
| Income history blank | `nodeId` race condition on load | Fixed: `fetchTeamHistory()` resolves `nodeId` from contract if store is null |
| Refresh requires reconnect | `fetchTeamHistory()` not called after wallet connect | Fixed: `loadNodeData().then(() => fetchTeamHistory())` in lifecycle |
| Income wrong USD | Using external API instead of oracle | Fixed: `_getBnbUsdPrice()` reads `NFEGlobal.bnbPrice()` first |
| Global sync missing old events | `queryFilter` block range exceeded RPC limit | Fixed: `getIncome()` reads contract storage directly, no block scan |

---

*Documentation generated: April 12, 2026 — NFEGlobal Hub v1.0*
