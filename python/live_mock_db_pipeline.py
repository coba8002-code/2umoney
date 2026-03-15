import sqlite3
import datetime
import random
import time
import math

print("==========================================")
print("   🚀 V7.0 MARGIN SCALP LIVE DB DAEMON    ")
print("==========================================")
print("Initializing Mock PostgreSQL -> SQLite Pipeline...")

# Connect to mock DB
db_path = "live_mock.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Mirror Prisma Schema logically
cursor.execute('''
CREATE TABLE IF NOT EXISTS trade_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currencyCode TEXT,
    tradeDate DATETIME,
    tradeType TEXT,
    price REAL,
    amount REAL,
    krwValue REAL,
    reason TEXT
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS portfolio_positions (
    currencyCode TEXT PRIMARY KEY,
    averagePrice REAL,
    amount REAL,
    currentValueKrw REAL,
    stopLossRate REAL,
    targetRate REAL,
    currentPhase INTEGER,
    updatedAt DATETIME
)
''')
conn.commit()
print("✅ DB Schema Loaded Successfully.")

def generate_mock_tick():
    ret1h = (random.random() - 0.5) * 0.02
    rsi5 = random.random() * 100
    zScore1h = (random.random() - 0.5) * 6
    return ret1h, rsi5, zScore1h

def predict_xgboost_scalp(ret1h, rsi5, zScore1h):
    scalpLogOdds = 0.0
    if ret1h > 0.005 and rsi5 < 70:
        scalpLogOdds += 0.8
    elif ret1h < -0.01 and zScore1h < -2.0:
        scalpLogOdds += 1.0
        
    if rsi5 > 80 and zScore1h > 2.0:
        scalpLogOdds -= 1.2
        
    return 1 / (1 + math.exp(-scalpLogOdds))

def run_scalp_daemon_tick():
    now = datetime.datetime.now().isoformat()
    currency_code = 'USD/KRW'
    current_price = 1350.0 + (random.random() - 0.5) * 5
    
    print(f"\n[{now}] 🕒 Fetching live market tick... (Price: {current_price:.2f})")
    
    # AI Engine
    ret1h, rsi5, zScore1h = generate_mock_tick()
    ml_prob = predict_xgboost_scalp(ret1h, rsi5, zScore1h)
    
    atr_val = current_price * 0.002
    stop_loss_rate = current_price - (atr_val * 0.5)   # Strict SL (-0.5x ATR)
    target_rate = current_price + (atr_val * 1.0)      # Tight TP (+1.0x ATR)
    
    action = "WAIT"
    if ml_prob > 0.55:
        action = "BUY_1"
        
    print(f"📊 AI Score: (Prob {ml_prob*100:.1f}%) | Action: {action} | Target: {target_rate:.2f} | Stop: {stop_loss_rate:.2f}")
    
    if action == "BUY_1":
        print("🚀 [EXECUTE] Generating V7 Margin Trade Entry!")
        
        capital = 10_000_000
        risk_pct = 0.05
        leverage = 10
        
        # Leveraged Position Size
        krw_value = capital * risk_pct * leverage
        amount = krw_value / current_price
        
        # 1. Insert Trade Log
        cursor.execute('''
            INSERT INTO trade_logs (currencyCode, tradeDate, tradeType, price, amount, krwValue, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (currency_code, now, 'BUY', current_price, amount, krw_value, f'AI Signal V7 Margin (Prob: {ml_prob:.2f})'))
        
        # 2. Upsert Portfolio Position
        cursor.execute("SELECT * FROM portfolio_positions WHERE currencyCode = ?", (currency_code,))
        pos = cursor.fetchone()
        
        if pos:
            # Update
            new_amount = pos[2] + amount
            new_krw = pos[3] + krw_value
            new_avg = new_krw / new_amount
            cursor.execute('''
                UPDATE portfolio_positions 
                SET averagePrice = ?, amount = ?, currentValueKrw = ?, stopLossRate = ?, targetRate = ?, updatedAt = ?
                WHERE currencyCode = ?
            ''', (new_avg, new_amount, new_krw, stop_loss_rate, target_rate, now, currency_code))
        else:
            # Insert
            cursor.execute('''
                INSERT INTO portfolio_positions (currencyCode, averagePrice, amount, currentValueKrw, stopLossRate, targetRate, currentPhase, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (currency_code, current_price, amount, krw_value, stop_loss_rate, target_rate, 1, now))
            
        conn.commit()
        print(f"✅ [DB COMMIT] Position stored successfully. Allocated Krw: {krw_value:,.0f}")
    else:
        print("⏳ Conditions not met. Waiting for next tick.")

# Run Daemon for 10 simulated intervals
for _ in range(8):
    run_scalp_daemon_tick()
    time.sleep(1)

cursor.execute("SELECT COUNT(*) FROM trade_logs")
trade_count = cursor.fetchone()[0]
print(f"\n🛑 Daemon cycle completed. Total Trade Logs in DB: {trade_count}")

conn.close()
