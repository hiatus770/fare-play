# FarePlay Implementation Status

## ✅ Completed (Frontend & UI)

### 1. **TopBar Component** (`TopBar.tsx`)
- User profile area with Solana wallet connection
- Display wallet address and balance
- About modal with game instructions
- Wallet disconnect functionality
- Stats display (Balance, Active Bets, Winrate)

### 2. **Enhanced Stop Sidebar** (`StopSidebarEnhanced.tsx`)
- **Step-by-step flow:**
  1. Route selection (501 Queen, 503 King)
  2. Stop selection with search
  3. Vehicle selection from arriving predictions
  4. Prediction input and bet placement

- **Community Activity Display:**
  - Total bets on this stop
  - Unique bettors count
  - Average prediction time
  - Success rate percentage

- **Vehicle Statistics:**
  - Times a specific vehicle was bet on
  - Average prediction for that vehicle
  - Vehicle accuracy score

- **Frozen Predictions (5 min ago):**
  - Shows what was predicted 5 minutes ago
  - Actual arrival time when vehicle passed
  - Accuracy indicator (early/late)

- **Betting Interface:**
  - Time prediction input (seconds)
  - Bet amount input (SOL)
  - Place bet button with loading state

### 3. **Interactive Map** (`InteractiveMap.tsx`)
- **Route Visualization:**
  - Route 501 (Queen Streetcar) - Red (#FF6B6B)
  - Route 503 (King Streetcar) - Teal (#4ECDC4)
  - Full route geometry from API

- **Stop Markers:**
  - All stops on selected route
  - Click stops to select in sidebar
  - Hover effects

- **Real-time Vehicles:**
  - Vehicle positions updated every 5 seconds
  - Click vehicles to select in sidebar
  - Highlighted selected vehicle
  - Vehicle ID displayed on marker

- **Map Features:**
  - Mapbox GL integration
  - Dark theme styling
  - Legend showing route colors
  - Info box showing selected route/stop
  - Boundary restricted to Toronto GTA

### 4. **State Management** (`page.tsx`)
- Centralized state for route, stop, vehicle selection
- Two-way synchronization between map and sidebar
- Props flow:
  - Map → selects stop/vehicle → updates sidebar
  - Sidebar → selects route/stop → updates map
  - Selection highlights propagate across UI

---

## 🔄 In Progress / Backend Work Needed

### 1. **User Database Schema**
Not yet implemented. Need to create:

```typescript
// Users Table
{
  id: string (Solana public key)
  wallet_address: string
  balance: number (SOL)
  total_bets: number
  total_wins: number
  win_rate: number
  joined_at: timestamp
}

// Bets Table
{
  id: string (uuid)
  user_id: string (FK to users)
  route: string (501/503)
  stop: string (stop tag)
  vehicle_id: string
  predicted_time: number (seconds)
  bet_amount: number (SOL)
  placed_at: timestamp
  actual_time: number | null (when vehicle passes)
  result: "pending" | "win" | "loss" | null
  accuracy_error: number | null (seconds off)
}

// Community Stats (Cached/Computed)
{
  route: string
  stop: string
  total_bets: number
  unique_bettors: number
  avg_prediction: number
  success_rate: number
  last_updated: timestamp
}
```

### 2. **Backend API Endpoints** (NEW)
Need to implement REST endpoints:

```
POST /api/user/connect
  - Connect Solana wallet
  - Return user profile

GET /api/stats/stop/{route}/{stop}
  - Return community metrics for this stop
  - (Currently mocked in frontend)

GET /api/stats/vehicle/{route}/{stop}/{vehicle}
  - Return vehicle-specific stats
  - (Currently mocked in frontend)

POST /api/bets/place
  - Place a new bet
  - Validate against Solana wallet balance
  - Return bet confirmation

GET /api/bets/user/{userId}
  - Get user's bet history
  - Show active/completed bets

GET /api/bets/settle/{betId}
  - Settle a bet once vehicle passes
  - Compare predicted vs actual
  - Distribute winnings
```

### 3. **Solana Integration**
Frontend is ready for:
- Wallet connection (placeholder implemented)
- SPL token transfers (ready for integration)
- Smart contract interactions for betting (if using contracts)

Backend needs:
- Solana RPC client setup
- Wallet balance verification
- Transaction signing and submission

---

## 🚀 Immediate Next Steps

### Phase 1: Backend User DB (PRIORITY)
1. Set up PostgreSQL or MongoDB for user data
2. Create user/bets schema
3. Implement auth with Solana wallet
4. Build API endpoints for stats and bet placement

### Phase 2: Wire Sidebar to Backend
1. Connect community metrics API to sidebar
2. Connect vehicle stats API to sidebar
3. Connect bet placement to Solana wallet & backend

### Phase 3: Real-time Updates
1. WebSocket connection for live vehicle positions
2. Live betting activity feed
3. Leaderboard updates

---

## 📊 Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│              TopBar (Wallet, About, Stats)              │
├─────────────────────────┬───────────────────────────────┤
│                         │                               │
│  Stop Sidebar (30%)     │    Interactive Map (70%)      │
│                         │                               │
│  • Route selection      │    • Route 501 & 503 lines    │
│  • Stop search/select   │    • Stop markers             │
│  • Predictions display  │    • Vehicle positions (live) │
│  • Community stats      │    • Click interactions       │
│  • Vehicle stats        │                               │
│  • Frozen predictions   │    (Connected to sidebar)     │
│  • Time input           │                               │
│  • Bet amount           │                               │
│  • Place bet button     │                               │
│                         │                               │
└─────────────────────────┴───────────────────────────────┘

Backend:
├── TTC API (http://5000)
│   ├── /route/{route}/geometry - Routes & stops
│   ├── /stop/{route}/{stop} - Current predictions
│   └── /health - Status check
│
├── User DB (NOT YET)
│   ├── Users table
│   ├── Bets table
│   └── Community stats cache
│
└── Betting API (NOT YET)
    ├── POST /api/bets/place
    ├── GET /api/stats/stop/{route}/{stop}
    └── POST /api/user/connect
```

---

## 📝 Frontend Complete

- [x] UI/UX designed and implemented
- [x] API endpoints integration for TTC data
- [x] Real-time vehicle tracking
- [x] Community metrics display (mocked)
- [x] Vehicle statistics display (mocked)
- [x] Betting UI ready
- [x] Wallet UI ready
- [x] TypeScript compilation passing
- [x] Map and sidebar synchronized

## ⚠️ Backend Still Needed

- [ ] User authentication with Solana
- [ ] User database
- [ ] Community stats computation
- [ ] Bet placement logic
- [ ] Bet settlement logic
- [ ] Balance verification
- [ ] Leaderboard generation
- [ ] Real-time WebSocket updates

---

## 🔑 Key Decisions Made

1. **Frontend-First Approach:** UI fully functional with mocked data
2. **Two-Way Sync:** Map and sidebar communicate via parent component state
3. **API-Ready:** All API endpoints documented for backend implementation
4. **Scalable:** Community metrics cached, not computed per request
5. **Modular:** Components independent and testable

---

## 🧪 How to Test (Frontend)

```bash
# Start the development server
npm run dev

# Map will load at http://localhost:3000
# Backend API required at http://localhost:5000

# Feature checklist:
✓ TopBar shows "FarePlay" with wallet button
✓ Sidebar shows route selection
✓ Click route → shows stop search
✓ Click stop on map → shows predictions
✓ Select vehicle → shows stats
✓ Enter prediction & bet → shows success message
✓ Map shows route lines & vehicles
✓ Click vehicles on map → selects in sidebar
```

---

Generated: 2026-02-08
Status: Frontend Complete, Backend Pending
