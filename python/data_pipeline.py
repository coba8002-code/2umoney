import yfinance as yf
import pandas as pd
import numpy as np
import time

CURRENCIES = [
    "USD", "EUR", "JPY", "GBP", "CAD", "CHF", "AUD", "NZD", 
    "HKD", "SGD", "TWD", "CNY", "THB", "MYR", "IDR", "PHP", "VND"
]

def fetch_fx_data_with_fallback(currency, period="3mo", interval="1d"):
    """
    Attempts to fetch FX data for [Currency]/KRW.
    If direct pairing (e.g., VNDKRW=X) fails or is missing,
    it falls back to calculating the cross rate via USD.
    Cross Rate Formula: [CUR]/KRW = (USD/KRW) / (USD/[CUR])
    """
    direct_ticker = f"{currency}KRW=X"
    
    if currency == "USD":
        # Base currency exception, just fetch USDKRW
        print(f"[{currency}] Fetching direct ticker: {direct_ticker}")
        df = yf.download(direct_ticker, period=period, interval=interval, progress=False)
        return df
        
    print(f"[{currency}] Attempting direct fetch: {direct_ticker}")
    df_direct = yf.download(direct_ticker, period=period, interval=interval, progress=False)
    
    # Check if df is valid and not empty
    if df_direct is not None and not df_direct.empty and len(df_direct) > 5:
        # Check if there are columns or MultiIndex issues
        if isinstance(df_direct.columns, pd.MultiIndex):
            # Sometimes yfinance returns MultiIndex if multiple tickers were queried (even by accident)
            target_col = ('Close', direct_ticker) if ('Close', direct_ticker) in df_direct.columns else 'Close'
            if not df_direct[target_col].dropna().empty:
                print(f"[{currency}] Direct fetch successful.")
                return df_direct

        elif 'Close' in df_direct.columns and not df_direct['Close'].dropna().empty:
            print(f"[{currency}] Direct fetch successful.")
            return df_direct

    # ========= FALLBACK STRATEGY: USD CROSS RATE =========
    print(f"[{currency}] Direct fetch failed. Engaging USD Cross-Rate Fallback...")
    
    usd_krw_ticker = "USDKRW=X"
    usd_cur_ticker = f"USD{currency}=X"
    
    try:
        # Fetch USD/KRW
        df_usd_krw = yf.download(usd_krw_ticker, period=period, interval=interval, progress=False)
        # Fetch USD/TargetCurrency (e.g., USD/VND)
        df_usd_cur = yf.download(usd_cur_ticker, period=period, interval=interval, progress=False)
        
        # Flatten MultiIndex if necessary
        if isinstance(df_usd_krw.columns, pd.MultiIndex):
            close_usd_krw = df_usd_krw['Close', usd_krw_ticker].squeeze()
            open_usd_krw = df_usd_krw['Open', usd_krw_ticker].squeeze()
            high_usd_krw = df_usd_krw['High', usd_krw_ticker].squeeze()
            low_usd_krw = df_usd_krw['Low', usd_krw_ticker].squeeze()
        else:
            close_usd_krw = df_usd_krw['Close'].squeeze()
            open_usd_krw = df_usd_krw['Open'].squeeze()
            high_usd_krw = df_usd_krw['High'].squeeze()
            low_usd_krw = df_usd_krw['Low'].squeeze()

        if isinstance(df_usd_cur.columns, pd.MultiIndex):
            close_usd_cur = df_usd_cur['Close', usd_cur_ticker].squeeze()
            open_usd_cur = df_usd_cur['Open', usd_cur_ticker].squeeze()
            high_usd_cur = df_usd_cur['High', usd_cur_ticker].squeeze()
            low_usd_cur = df_usd_cur['Low', usd_cur_ticker].squeeze()
        else:
            close_usd_cur = df_usd_cur['Close'].squeeze()
            open_usd_cur = df_usd_cur['Open'].squeeze()
            high_usd_cur = df_usd_cur['High'].squeeze()
            low_usd_cur = df_usd_cur['Low'].squeeze()

        # Align indexes to ensure dates match perfectly
        aligned_krw, aligned_cur = close_usd_krw.align(close_usd_cur, join='inner')
        aligned_open_krw, aligned_open_cur = open_usd_krw.align(open_usd_cur, join='inner')
        aligned_high_krw, aligned_high_cur = high_usd_krw.align(high_usd_cur, join='inner')
        aligned_low_krw, aligned_low_cur = low_usd_krw.align(low_usd_cur, join='inner')
        
        # Calculate Cross Rates: Cur/KRW = (USD/KRW) / (USD/Cur)
        # Note: For Highs/Lows in cross rate division, approx matching is:
        # High = High_KRW / Low_Cur (Maximizing numerator, minimizing denominator)
        # Low = Low_KRW / High_Cur
        
        synth_close = aligned_krw / aligned_cur
        synth_open = aligned_open_krw / aligned_open_cur
        synth_high = aligned_high_krw / aligned_low_cur
        synth_low = aligned_low_krw / aligned_high_cur
        
        # Construct synthetic dataframe
        df_synthetic = pd.DataFrame({
            'Open': synth_open,
            'High': synth_high,
            'Low': synth_low,
            'Close': synth_close
        })
        
        print(f"[{currency}] Cross-Rate Fallback successful (Derived from {usd_cur_ticker}).")
        return df_synthetic
        
    except Exception as e:
        print(f"[{currency}] CRITICAL ERROR: Fallback also failed. Details: {e}")
        return pd.DataFrame() # Empty dataframe on terminal failure

if __name__ == "__main__":
    print("=== STARTING ROBUST FX DATA PIPELINE ===")
    
    collected_data = {}
    failed_currencies = []
    
    for currency in CURRENCIES:
        df = fetch_fx_data_with_fallback(currency, period="1mo", interval="1d")
        
        if not df.empty:
            collected_data[currency] = df
            last_date = df.index[-1].strftime('%Y-%m-%d')
            last_price = df['Close'].iloc[-1]
            print(f" -> {currency}/KRW Latest Data: {last_date} | Price: {last_price:,.4f}\n")
        else:
            failed_currencies.append(currency)
            print(f" -> {currency}/KRW FAILED ENTIRELY.\n")
            
        time.sleep(0.5) # Rate limiting buffer
        
    print("=== SUMMARY ===")
    print(f"Total Successful: {len(collected_data)}/17")
    if failed_currencies:
        print(f"Failed Currencies needing Level 2 Fallback: {failed_currencies}")
    else:
        print("100% COVERAGE ACHIEVED! All 17 currencies collected successfully with Fallback Logic.")
