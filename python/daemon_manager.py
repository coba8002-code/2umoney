import sqlite3
import datetime
import random
import time
import math
import sys
import os

print("==========================================")
print("   🔄 V7.0 MARGIN SCALP DAEMON MANAGER    ")
print("==========================================")

db_path = "live_mock.db"
# Ensure we are in the correct directory or path is absolute
script_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(script_dir, "..", "live_mock.db")

def ensure_db_schema():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS trade_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, currencyCode TEXT, tradeDate DATETIME, tradeType TEXT, price REAL, amount REAL, krwValue REAL, reason TEXT)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS portfolio_positions (
        currencyCode TEXT PRIMARY KEY, averagePrice REAL, amount REAL, currentValueKrw REAL, stopLossRate REAL, targetRate REAL, currentPhase INTEGER, updatedAt DATETIME)''')
    conn.commit()
    conn.close()

def generate_mock_tick():
    ret1h = (random.random() - 0.5) * 0.02
    rsi5 = random.random() * 100
    zScore1h = (random.random() - 0.5) * 6
    return ret1h, rsi5, zScore1h

def predict_xgboost_scalp(ret1h, rsi5, zScore1h):
    scalpLogOdds = 0.0
    if ret1h > 0.005 and rsi5 < 70: scalpLogOdds += 0.8
    elif ret1h < -0.01 and zScore1h < -2.0: scalpLogOdds += 1.0
    if rsi5 > 80 and zScore1h > 2.0: scalpLogOdds -= 1.2
    return 1 / (1 + math.exp(-scalpLogOdds))

def run_daemon_tick():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        now = datetime.datetime.now().isoformat()
        currency_code = 'USD/KRW'
        current_price = 1350.0 + (random.random() - 0.5) * 5
        
        print(f"\n[{now}] 🕒 Scanning market... (USD/KRW: {current_price:.2f})")
        
        ret1h, rsi5, zScore1h = generate_mock_tick()
        ml_prob = predict_xgboost_scalp(ret1h, rsi5, zScore1h)
        
        atr_val = current_price * 0.002
        stop_loss_rate = current_price - (atr_val * 0.5)
        target_rate = current_price + (atr_val * 1.0)
        
        action = "WAIT"
        if ml_prob > 0.55: # Force higher execution rate for demo
            action = "BUY_1"
            
        print(f"   ↳ AI Prob: {ml_prob*100:.1f}% | Target: {target_rate:.2f} | Stop: {stop_loss_rate:.2f} | Decision: {action}")
        
        if action == "BUY_1":
            print("   🚀 [EXECUTION] V7 Margin Signal Detected! Entering Position...")
            capital = 10_000_000
            risk_pct = 0.05
            leverage = 10
            krw_value = capital * risk_pct * leverage
            amount = krw_value / current_price
            
            cursor.execute('INSERT INTO trade_logs (currencyCode, tradeDate, tradeType, price, amount, krwValue, reason) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                           (currency_code, now, 'BUY', current_price, amount, krw_value, f'AI Signal V7 (Prob: {ml_prob:.2f})'))
            
            cursor.execute("SELECT * FROM portfolio_positions WHERE currencyCode = ?", (currency_code,))
            pos = cursor.fetchone()
            
            if pos:
                new_amount = pos[2] + amount
                new_krw = pos[3] + krw_value
                new_avg = new_krw / new_amount
                cursor.execute('UPDATE portfolio_positions SET averagePrice = ?, amount = ?, currentValueKrw = ?, stopLossRate = ?, targetRate = ?, updatedAt = ? WHERE currencyCode = ?', 
                               (new_avg, new_amount, new_krw, stop_loss_rate, target_rate, now, currency_code))
            else:
                cursor.execute('INSERT INTO portfolio_positions (currencyCode, averagePrice, amount, currentValueKrw, stopLossRate, targetRate, currentPhase, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                               (currency_code, current_price, amount, krw_value, stop_loss_rate, target_rate, 1, now))
            conn.commit()
            print(f"   ✅ [DATABASE] Committed 10x Leveraged Position. Krw Extr.: {krw_value:,.0f}")
        
        conn.close()
    except Exception as e:
        print(f"   ❌ [ERROR] Tick failed: {str(e)}")

def start_scheduler(interval_seconds=5):
    print(f"✅ Daemon Manager Started. Running tick engine every {interval_seconds} seconds. Press Ctrl+C to stop.")
    ensure_db_schema()
    
    try:
        while True:
            run_daemon_tick()
            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        print("\n🛑 Gracefully shutting down V7 Scalp Manager...")
        sys.exit(0)

if __name__ == "__main__":
    # If passed an argument, use it as interval
    interval = 5
    if len(sys.argv) > 1:
        interval = int(sys.argv[1])
    start_scheduler(interval)
