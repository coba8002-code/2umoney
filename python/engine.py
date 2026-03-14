import os
import yfinance as yf
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

def fetch_data():
    """Fetch historical currency data from Yahoo Finance"""
    # Note: For Toss 17 Currencies
    tickers = ["KRW=X", "JPYKRW=X", "EURKRW=X", "CHFKRW=X", "GBPKRW=X", 
               "AUDKRW=X", "NZDKRW=X", "CADKRW=X", "CNYKRW=X", "HKDKRW=X", 
               "SGDKRW=X", "THBKRW=X", "THBKRW=X", "VND=X", "MYRKRW=X"]
    
    print("Initializing FX Data Fetching Pipeline...")
    # TODO: Connect to Postgres via psycopg2 using os.getenv("DATABASE_URL")
    # TODO: Compute regime classification via sklearn
    # TODO: Perform article NLP sentiment analysis

if __name__ == "__main__":
    fetch_data()
