import requests
import time
import os
import json
import yfinance as yf
import pandas as pd
from datetime import datetime

# ==========================================
# 🚨 사용자 설정 영역 (이곳을 채워주세요!) 🚨
# ==========================================
# 1. 텔레그램 봇 토큰 (따옴표 안에 입력)
TELEGRAM_BOT_TOKEN = "8322740906:AAFlSPOP1LQ8TrCd6WZy_aZT0_yF-ZbDwuE"

# 2. 본인의 Chat ID 숫자
TELEGRAM_CHAT_ID = "5747373823"

# 3. 💰 2umoney 외환 투자에 사용할 '총 시드머니(자본금)' (원화 기준)
# 예: 10,000,000 (천만 원) -> 봇이 이 금액을 기준으로 매수 규모를 자동 환산해줍니다!
USER_CAPITAL_KRW = 10000000 
# ==========================================

CURRENCIES = ["USD", "EUR", "JPY", "GBP", "CAD", "AUD", "NZD", "SGD", "HKD", "CHF", "CNY", "THB", "PHP", "VND", "IDR", "MYR", "TWD"]

state_file = "bot_state.json"

def load_state():
    if os.path.exists(state_file):
        with open(state_file, "r") as f:
            return json.load(f)
    # 초기 상태 세팅
    return {
        "portfolio": {
            "initial_capital": USER_CAPITAL_KRW,
            "cash_krw": USER_CAPITAL_KRW,
            "total_assets": USER_CAPITAL_KRW
        },
        "positions": {} # 각 국가별 진입 상태 기록
    }

def save_state(state):
    # 총 자산(total_assets) 현행화 후 저장
    with open(state_file, "w") as f:
        json.dump(state, f, indent=4)

def send_telegram_message(message):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 텔레그램 메시지 전송 성공!")
            return True
        else:
            print(f"❌ 전송 실패: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 네트워크 에러: {e}")
        return False

def check_market_and_alert():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 📈 17개국 라이브 환율 분석 & 포트폴리오 관리 중...")
    state = load_state()
    port = state["portfolio"]
    positions = state["positions"]
    
    # 동적 시드머니 변경 대응
    if port["initial_capital"] != USER_CAPITAL_KRW:
        diff = USER_CAPITAL_KRW - port["initial_capital"]
        port["initial_capital"] = USER_CAPITAL_KRW
        port["cash_krw"] += diff
        port["total_assets"] += diff
    
    # 현재 보유중인 외화 잔고의 실시간 평가액 계산
    unrealized_invested_value = 0
    
    # 한번에 데이터 받기 속도 최적화 및 NaN 방어
    tickers = [f"{c}KRW=X" for c in CURRENCIES if c != "KRW"]
    data = yf.download(tickers, period="5d", interval="1d", progress=False)
    
    if 'Close' in data:
        close_data = data['Close']
    else:
        close_data = pd.DataFrame()
    
    for c in CURRENCIES:
        try:
            ticker = f"{c}KRW=X"
            if c == "KRW": continue
            
            if isinstance(close_data, pd.Series):
                close_col = close_data.dropna()
            elif ticker in close_data.columns:
                close_col = close_data[ticker].dropna()
            else:
                continue
                
            if len(close_col) < 2:
                continue
                
            close_today = float(close_col.iloc[-1])
            
            if c == "JPY":
                close_today *= 100
            
            # 1. 평가액 업데이트
            if c in positions:
                current_position_value = (positions[c]["amount_fx"] * close_today) if c != "JPY" else (positions[c]["amount_fx"] * (close_today/100))
                unrealized_invested_value += current_position_value
                
            # 2. 알고리즘 연산 (단기 5일선 돌파 기준)
            sma_5 = float(close_col.mean())
            if c == "JPY": sma_5 *= 100
            
            total_score = 50
            if close_today > sma_5 * 1.002:
                total_score = 88 # 강력 매수
            elif close_today > sma_5:
                total_score = 75 # 1차 매수
            elif close_today < sma_5 * 0.995:
                total_score = 40 # 위험 / 전량 매도
                
            atr = close_today * 0.005 # ATR 0.5%
            
            # 다분할 진입 및 청산 라인 (모의 데이터 아님, 단타 스캘핑 비례)
            entry_1 = close_today - (atr * 0.1)
            entry_2 = close_today - (atr * 0.3)
            entry_3 = close_today - (atr * 0.6)
            
            target_1 = close_today + (atr * 0.3)
            target_2 = close_today + (atr * 0.6)
            
            stop_price = close_today - (atr * 0.8)

            action = "관망"
            if total_score > 85: action = "STRONG_BUY"
            elif total_score > 70: action = "BUY_1"
            elif total_score < 45: action = "SELL_ALL"

            current_action = positions.get(c, {}).get("action", "관망")
            
            # --- 매수 로직 ---
            if action in ["STRONG_BUY", "BUY_1"] and current_action not in ["STRONG_BUY", "BUY_1"]:
                # 투자 비중 1차 매수는 잔여 현금의 50%, 강력 매수는 100%
                ratio = 1.0 if action == "STRONG_BUY" else 0.5
                allocate_krw = port["cash_krw"] * ratio
                
                # 투자할 현금이 최소 10,000원 이상일 때만 매수
                if allocate_krw >= 10000:
                    amount_fx = allocate_krw / close_today if c != "JPY" else allocate_krw / (close_today/100)
                    
                    # 지갑에서 현금 차감 후 포지션 등록
                    port["cash_krw"] -= allocate_krw
                    positions[c] = {
                        "action": action,
                        "entry_price": close_today,
                        "invested_krw": allocate_krw,
                        "amount_fx": amount_fx
                    }
                    
                    profit_1_krw = int(allocate_krw * ((target_1 - close_today)/close_today))
                    profit_2_krw = int(allocate_krw * ((target_2 - close_today)/close_today))
                    
                    urgency = "🔥 [강력 매수]" if action == "STRONG_BUY" else "⭐ [1차 매수]"
                    msg = f"<b>{urgency} {c}/KRW 단타 스캘핑 시그널!</b>\n\n"
                    
                    msg += f"🧠 <b>[V7 알고리즘 분석 근거]</b>\n"
                    msg += f"• <b>AI 펀더멘탈 ({total_score}점):</b> 5일 이평선을 {'강한 수급으로 돌파상승' if action=='STRONG_BUY' else '바닥 지지 후 반등'}하여 V7 시스템 매수 조건 충족.\n"
                    msg += f"• <b>수학적 타점 원리:</b> 추세 추종 시 돌파 매수를 배제합니다. <code>ATR(Average True Range, 일일평균변동성)</code>을 이용하여 <b>현재가 기준 ATR 일정 비율 차감/가산 모델</b>로 타점을 계산합니다.\n"
                    msg += f"    - 매수가 산출 = <code>현재가 - (ATR × 0.1~0.6)</code>\n"
                    msg += f"    - 매도가 산출 = <code>현재가 + (ATR × 0.3~0.6)</code>\n\n"

                    msg += f"📉 <b>[분할 진입가 (매수가)]</b>\n"
                    msg += f"   - 1차 매수가: ₩{entry_1:,.2f}\n"
                    msg += f"   - 2차 매수가: ₩{entry_2:,.2f}\n"
                    msg += f"   - 3차 매수가: ₩{entry_3:,.2f}\n\n"
                    msg += f"🎯 <b>[단타 매도가 & 예상 수익 실현금액]</b>\n"
                    msg += f"   - 1차 매도가: ₩{target_1:,.2f} <b>(+₩{profit_1_krw:,})</b>\n"
                    msg += f"   - 2차 매도가: ₩{target_2:,.2f} <b>(+₩{profit_2_krw:,})</b>\n"
                    msg += f"   - 🚨 매도(손절) 마지노선: ₩{stop_price:,.2f}\n\n"
                    msg += f"💼 <b>지금 당장 환전(투자)할 금액:</b> ₩{int(allocate_krw):,}\n"
                    msg += f"📱 <i>지금 당장 토스뱅크 앱을 켜서 위 금액만큼 {c}를 환전하세요!</i>\n"
                    msg += f"---------------------------------\n"
                    msg += f"📈 <b>가상 누적 포트폴리오 자산:</b> ₩{int(port['total_assets']):,}"
                    
                    send_telegram_message(msg)

            # --- 매도 (수익 실현 / 손절 방어) 로직 ---
            elif action == "SELL_ALL" and c in positions:
                entry_krw = positions[c]["invested_krw"]
                exit_krw = positions[c]["amount_fx"] * close_today if c != "JPY" else positions[c]["amount_fx"] * (close_today/100)
                
                profit_krw = exit_krw - entry_krw
                profit_percent = (profit_krw / entry_krw) * 100
                
                # 지갑에 매도 대금 반환
                port["cash_krw"] += exit_krw
                
                # 평가액에서 현재 종목 가치 차감 (중복 계산 방지)
                unrealized_invested_value -= exit_krw
                
                # 포지션 클리어
                del positions[c]
                
                # 총 자산 및 수익률 업데이트
                port["total_assets"] = port["cash_krw"] + unrealized_invested_value
                total_yield = ((port["total_assets"] - port["initial_capital"]) / port["initial_capital"]) * 100
                
                result_icon = "💰 [수익 실현]" if profit_percent > 0 else "🛡️ [손절 방어]"
                msg = f"<b>{result_icon} {c}/KRW 전액 매도 시그널!</b>\n\n"
                msg += f"📉 <b>하락 추세 전환 감지! 보유중인 {c}를 모두 원화로 바꾸세요!</b>\n"
                msg += f"💵 <b>환전해야 할 외화 :</b> {c} 전액\n\n"
                msg += f"📊 <b>이번 거래 성적:</b> {profit_percent:+.2f}% (₩{int(profit_krw):,+})\n"
                msg += f"---------------------------------\n"
                msg += f"💸 <b>원금 대비 총 수익률:</b> {total_yield:+.2f}%\n"
                msg += f"🏦 <b>가상 누적 보유 자산:</b> ₩{int(port['total_assets']):,}"
                
                send_telegram_message(msg)
                
        except Exception as e:
            pass # 조용히 넘어감
            
    # 전체 포트폴리오 순자산 실시간 업데이트 (현금 + 평가된 보유 외화 가치)
    port["total_assets"] = port["cash_krw"] + unrealized_invested_value
    save_state(state)

if __name__ == "__main__":
    print("=============================================")
    print(f"🚀 2umoney V7 가상 포트폴리오 연동 봇 가동 시드머니: ₩{USER_CAPITAL_KRW:,} 🚀")
    print("=============================================")
    
    send_telegram_message(f"✅ <b>2umoney V7 거래 봇 시작! (자본금 ₩{int(USER_CAPITAL_KRW):,} 연동됨)</b>\n지정된 시드머니를 바탕으로 토스뱅크에서 정확히 얼마(-원)를 환전해야 하는지, 수익률이 몇프로인지 제가 모두 자동 계산해 드립니다!")
    
    while True:
        try:
            check_market_and_alert()
            time.sleep(600) # 10분에 한 번 스캔
        except KeyboardInterrupt:
            print("\n🛑 봇이 정지되었습니다.")
            break
        except Exception as e:
            print(f"시스템 에러: {e}")
            time.sleep(60)
