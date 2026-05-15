#!/usr/bin/env python3
import os
import ssl
import time
import smtplib
import requests
import traceback
from pathlib import Path
from email.message import EmailMessage
from dotenv import load_dotenv

# ─── 1. Load Environment ──────────────────────────────────────────────────────
def load_environment():
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print("✅ Environment variables loaded from .env")
    else:
        print("❌ Error: .env file not found! Please create one.")
        exit(1)

# ─── 2. Supabase Data Fetching ────────────────────────────────────────────────
def get_supabase_data():
    """Fetches both the latest water level and the list of user emails."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }

    level_url = f"{url.rstrip('/')}/rest/v1/sensor_logs?select=water_level&order=created_at.desc&limit=1"
    level_res = requests.get(level_url, headers=headers, timeout=15)
    level_res.raise_for_status()
    level_data = level_res.json()
    current_level = float(level_data[0]['water_level']) if level_data else None

    users_url = f"{url.rstrip('/')}/rest/v1/user_profiles?select=email&role=eq.user"
    users_res = requests.get(users_url, headers=headers, timeout=15)
    users_res.raise_for_status()
    emails = [r['email'] for r in users_res.json() if r.get('email')]

    return current_level, emails

# ─── 3. Email Dispatcher ──────────────────────────────────────────────────────
def broadcast_alert(emails, level, threshold):
    """Logs into Gmail and sends the alert to every user in the list."""
    gmail_user = os.getenv("GMAIL_USER")
    gmail_pw = os.getenv("GMAIL_APP_PASSWORD")
    
    if not gmail_user or not gmail_pw:
        print("❌ Email credentials missing. Cannot send alert.")
        return

    subject = "⚠️ URGENT: Flood Alert - High Water Level"
    body = (
        "This is an automated emergency notification.\n\n"
        f"CRITICAL WATER LEVEL DETECTED: {level}\n"
        f"EVACUATION THRESHOLD: {threshold}\n\n"
        "Please move to a safe location immediately."
    )

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as server:
            server.starttls(context=context)
            server.login(gmail_user, gmail_pw)
            
            for recipient in emails:
                msg = EmailMessage()
                msg["Subject"] = subject
                msg["From"] = gmail_user
                msg["To"] = recipient
                msg.set_content(body)
                server.send_message(msg)
                print(f"   ✉️ Alert sent to: {recipient}")
    except Exception as e:
        print(f"   ❌ SMTP Error: {e}")

# ─── 4. Main Automation Loop ──────────────────────────────────────────────────
def monitor_system():
    load_environment()
    
    threshold = float(os.getenv("ALERT_THRESHOLD", "20"))
    check_interval = 3  # Seconds between database checks
    alert_sent = False   # State tracker to prevent email spam

    print(f"🚀 System Online. Monitoring every {check_interval}s...")
    print(f"Trigger: Water Level <= {threshold}")
    print("-" * 40)

    while True:
        try:
            level, user_list = get_supabase_data()
            
            if level is None:
                print("⚠️ No sensor data found in Supabase.")
            else:
                timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
                print(f"[{timestamp}] Current Level: {level}")

                if level <= threshold:
                    if not alert_sent:
                        print("🚨 THRESHOLD BREACHED! Sending emails...")
                        broadcast_alert(user_list, level, threshold)
                        alert_sent = True
                    else:
                        print("⏳ Level still low, but alert already sent. Waiting for reset.")
                elif level > threshold and alert_sent:
                    print("✅ Water level back to safe range. Resetting alert trigger.")
                    alert_sent = False

        except Exception as e:
            print(f"❗ Loop Error: {e}")
            traceback.print_exc()

        time.sleep(check_interval)

if __name__ == "__main__":
    try:
        monitor_system()
    except KeyboardInterrupt:
        print("\n👋 Monitoring stopped by user.")
