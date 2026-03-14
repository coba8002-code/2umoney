# 2umoney - Advanced FX Trading Decision Engine

A personal, institutional-grade foreign exchange (FX) quantitative dashboard built with Next.js, TypeScript, and Prisma. It leverages multi-dimensional scoring algorithms, historical pattern matching, natural language processing (NLP) for news sentiment, and market regime detection to generate highly optimized, progressive sizing execution plans for **Toss Bank's Auto-Exchange (토스 자동환전)** feature.

![Dashboard Preview](docs/dashboard-preview.png)

## 📌 1. Project Overview

**2umoney** is designed to eliminate emotional and discretionary bias from daily FX trading across 17 different currency pairs. Instead of fully automated API trading (which is legally restricted or technically complex for retail FX accounts in Korea), this project embraces a **"Human-in-the-loop Auto-Execution"** bridge. 

The analytical engine processes vast amounts of data overnight, computes absolute probabilities, and spits out clear, copy-pasteable Limit Orders (목표가/금액). The user simply inputs these into the Toss App's Auto-Exchange settings every morning.

### The "Why Semi-Automated?" Approach
Banks like Toss do not offer open public trading APIs for retail FX. However, Toss *does* offer a powerful "Auto-Exchange (자동환전)" feature that allows users to pre-set desired exchange rates and target amounts. **2umoney acts as the "Brain"**, calculating exactly *what* those rates and amounts should be based on complex quant logic, while Toss acts as the "Hands" executing the trades slippage-free at zero spread.

---

## 🚀 2. Getting Started (Installation)

### Prerequisites
- Node.js (v18+)
- PostgreSQL (Local or Cloud)
- Python 3.10+ (For future ML/Data-pipeline extensions)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/2umoney.git
   cd 2umoney
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the Database:
   - Create a `.env` file and set your `DATABASE_URL` (e.g., `postgresql://user:password@localhost:5432/2umoney`).
   - Run Prisma migrations and seed the mock data:
   ```bash
   npx prisma migrate dev --name init
   npm run seed:dummy
   ```
4. Start the Development Server:
   ```bash
   npm run dev
   ```
   *Dashboard runs on `http://localhost:3000`*

---

## 📁 3. Folder Structure Architecture

```text
2umoney/
├── prisma/
│   ├── schema.prisma      # DB Models (Currencies, Rates, Logs, Settings)
│   ├── seedDummy.ts       # Mock time-series data generator
│   └── seed.ts            # Base strategy group constants
├── src/
│   ├── app/               # Next.js App Router (UI Layer)
│   │   ├── api/           # Backend API Endpoints (Data & Trigger bridges)
│   │   ├── backtest/      # Simulation & Performance Reports
│   │   ├── currency/      # Multi-timeframe Charting & Depth analysis
│   │   ├── portfolio/     # PnL & Group Exposure Constraints Tracker
│   │   ├── settings/      # Risk %, Exposure limits, System overrides
│   │   ├── toss/          # UI optimized for Toss App copying
│   │   ├── trades/        # Manual trade logger & auto-averager
│   │   └── page.tsx       # Main Dashboard (Summary, Top Picks)
│   ├── engine/            # The Brains (TypeScript Core Logic)
│   │   ├── scoring.ts     # The 100-point aggregation logic
│   │   ├── actionEngine.ts# Maps scores to actionable states (BUY_ADD, HOLD)
│   │   ├── positionEngine.ts # Capital sizing (40/30/30 split logic)
│   │   ├── patternEngine.ts  # Cosine similarity vector matching
│   │   ├── regimeEngine.ts   # Macro environment context mapping
│   │   └── newsEngine.ts     # GDELT/NLP Sentiment modifier mock
│   ├── components/        # Reusable UI (Recharts, Tables, Cards)
│   └── lib/               # Utility functions (cn, date formatters)
└── package.json
```

---

## ⚙️ 4. Data Flow & Execution Pipeline

1. **Nightly Ingestion (Future Cron):** Python microservices fetch OHLCV from Yahoo Finance, News from GDELT, and Macro Events from Economic Calendars.
2. **Analysis Trigger:** `POST /api/*/run` endpoints trigger the internal `engine/*.ts` modules.
3. **Regime & Pattern Matching:** The current market context is classified (e.g., `USD_STRONG`), and similar historical patterns are vectorized to calculate mathematical Expectancy.
4. **Scoring Aggregation:** `scoring.ts` aggregates 6 disparate models into a single `finalScore` (0-100).
5. **Action & Sizing Mapping:** The engine determines the optimal move (`BUY_1`, `SELL_SPLIT`, etc.) and strictly limits position sizes against total equity and strategy group rules.
6. **Frontend Display:** User opens Next.js UI, views the `Toss Execution Plans`, and manually enters the 3-phase limit orders into the Toss App.
7. **Execution Logging:** When Toss executes a plan, the user logs it in `/trades`. The internal Portfolio Engine automatically recalculates average cost basis and active holding phases.

---

## 🧮 5. Algorithm Breakdown

### A. The 100-Point Scoring System (`scoring.ts`)
The core verdict on any currency pair is an aggregated weighted score based on six pillars:
* **Structure (20):** Trend alignment across Multi-timeframes (Weekly vs Daily).
* **Pattern (20):** Statistical profitability and MDD of historically matching vectors.
* **Timing (15):** Mean-reverting oscillators (RSI, Z-Score, Bollinger Band distance).
* **News/Event Risk (10):** Sentiment polarity and policy uncertainty scores.
* **Regime Fit (20):** How well this currency performs in the prevailing global macro condition.
* **Expected Value (15):** The purely mathematical `(WinRate * AvgWin) - (LossRate * AvgLoss)`.

### B. Regime Engine (`regimeEngine.ts`)
Different currencies act differently in varying environments.
- Identifies environments like `RISK_OFF`, `USD_STRONG`, or `CHINA_SENSITIVE`.
- Applies a `regimeFitScore`. E.g., Safe-haven currencies (Group A: USD, CHF) get score boosts during `RISK_OFF` periods, while Emerging Markets (Group D: THB, MYR) face severe penalties.

### C. Pattern Similarity (`patternEngine.ts`)
- Converts recent price action (e.g., last 14 days of returns + volatility) into an N-dimensional `PatternFeatureVector`.
- Uses Cosine Similarity against historical DB records.
- Extracts the Top *K* most similar periods in history and models the aggregated forward return probabilities (WinRate, Average Return 5d/10d).

### D. Expected Value (EV) & Betting Grade
Rather than relying on vague indicators, positions are sized dynamically using Kelly Criterion-inspired mathematics:
```text
Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
If EV < 0 AND Penalty applies -> System forces a 'WAIT' or 'WATCH' state.
```

### E. Toss Auto-Exchange Execution Sizing (`positionEngine.ts`)
Position weights are mathematically anchored to stop-loss depth and account equity to ensure equalized risk:
1. `RiskCapital = TotalEquity * 0.7% (Default Risk)`
2. `Recommended Krw = RiskCapital / StopLossDistance(%)`
3. Engine dynamically slashes the recommended amount if Macro Risk is high or the currency sits in a highly volatile Strategy Group (D).

**The 40-30-30 Progressive Rule:**
Never buy all at once. The engine splits the recommendation into 3 limit orders:
- **Phase 1 (40% Weight):** Entering slightly below current price (-0.2%).
- **Phase 2 (30% Weight):** Buying the dip (-1.0%).
- **Phase 3 (30% Weight):** Final defense line right above Stop Loss (-1.8%).

---

## 🔮 6. Future Data Integration Points

The Next-Gen engines have been written using robust `interface` boundaries and mock data loaders specifically so that they can be hotswapped for live APIs:
- **Yahoo Finance (yfinance):** To replace the `seedDummy.ts` with real nightly 10-year OHLCV histories.
- **GDELT / News API:** To feed real-time headlines into the NLP News Engine parser.
- **TradingView Webhooks:** To act as the structural charting source of truth.
- **Automated Logging:** While scraping Toss is complex, exploring accessibility OCR or Notification parsing to auto-log Toss executions into the `/api/trades` route.
