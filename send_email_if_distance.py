#!/usr/bin/env python3
"""
send_email_if_distance.py

Fetches water_level from Supabase and emails users if below threshold.
Integrated with .env for Gmail and Supabase credentials.
"""

import os
import ssl
import smtplib
import argparse
import requests
import traceback
from pathlib import Path
from email.message import EmailMessage
from dotenv import load_dotenv
import time

# ─── Configuration & Load Env ────────────────────────────────────────────────

def load_environment():
    """Loads the .env file from the current directory."""
    env_path = Path(".env")
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print("✓ Environment variables loaded from .env")
    else:
        print("! Warning: .env file not found. Ensure it is in the same directory.")

# ─── Email Logic ─────────────────────────────────────────────────────────────

def send_email_gmail(
    subject: str,
    body: str,
    gmail_user: str,
    gmail_app_password: str,
    to_email: str,
    from_email=None,
    dry_run: bool = False,
    html_body: str | None = None,
) -> None:
    if from_email is None:
        from_email = gmail_user

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    if dry_run:
        print(f"[DRY RUN] Would send to {to_email}")
        return

    context = ssl.create_default_context()
    # Using Gmail SMTP settings
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(gmail_user, gmail_app_password)
        server.send_message(msg)


# ─── Supabase Helpers ────────────────────────────────────────────────────────

def fetch_latest_water_level(supabase_url: str, service_role: str):
    hdrs = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
    }
    endpoint = (
        f"{supabase_url.rstrip('/')}/rest/v1/sensor_logs"
        "?select=water_level"
        "&order=created_at.desc"
        "&limit=1"
    )
    resp = requests.get(endpoint, headers=hdrs, timeout=30)
    resp.raise_for_status()
    rows = resp.json()

    if not rows:
        return None
    
    water_level = rows[0].get("water_level")
    return float(water_level) if water_level is not None else None


def fetch_approved_user_emails(supabase_url: str, service_role: str):
    hdrs = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
    }
    endpoint = (
        f"{supabase_url.rstrip('/')}/rest/v1/user_profiles"
        "?select=email"
        "&role=eq.user"
    )
    resp = requests.get(endpoint, headers=hdrs, timeout=30)
    resp.raise_for_status()
    return [r.get("email") for r in resp.json() if r.get("email")]


def fetch_all_user_emails(supabase_url: str, service_role: str):
    """Fetch all approved user emails for automated alerts."""
    return fetch_approved_user_emails(supabase_url, service_role)


def check_and_alert(distance: float, threshold: float, gmail_user: str, gmail_app_password: str, to_email: str, from_email: str | None = None, dry_run: bool = False) -> bool:
    if distance <= threshold:
        if from_email is None:
            from_email = gmail_user

        subject = "🚨WARNING: Water Level is too HIGH"
        max_depth = 100
        # reverse the distance to a water level (e.g. distance 20 -> water_level 80)
        water_level = max(0, max_depth - float(distance))

        plain_body = (
            "Aqua-Alert\n"
            "================\n\n"
            "🚨WARNING: The water level is too HIGH. You need to evacuate immediately.\n\n"
            f"Measured water level: {water_level}\n"
          
        )

        html_body = (
            "<html><body>"
            "<h2>Aqua-Alert</h2>"
            "<hr>"
            "<p><strong>🚨WARNING:</strong> The water level is too HIGH. You need to evacuate immediately.</p>"
            f"<p><strong>Measured water level:</strong> {water_level} cm </p>"
         
            "<hr>"
            "</body></html>"
        )
        try:
            send_email_gmail(
                subject=subject,
                body=plain_body,
                html_body=html_body,
                gmail_user=gmail_user,
                gmail_app_password=gmail_app_password,
                to_email=to_email,
                from_email=from_email,
                dry_run=dry_run,
            )
            return True
        except Exception as e:
            print("Error sending email:", e)
            traceback.print_exc()
            return False
    return False


# ─── Main Execution ──────────────────────────────────────────────────────────

def main() -> int:
    # 1. Initialize
    load_environment()
    
    parser = argparse.ArgumentParser(description="Flood Alert System")
    parser.add_argument("--distance", type=float, help="Measured distance")
    parser.add_argument("--to", dest="to", help="Recipient email (overrides ALERT_TO env)")
    parser.add_argument("--gmail_user", help="Gmail address (overrides GMAIL_USER env)")
    parser.add_argument("--gmail_app_password", "--token", dest="gmail_app_password", help="Gmail app password")
    parser.add_argument("--threshold", type=float, default=None, help="Alert threshold (default 20)")
    parser.add_argument("--from_email", help="From email header (optional)")
    parser.add_argument("--dry-run", action="store_true", help="Don't send actual emails")
    parser.add_argument("--send-all", action="store_true", dest="send_all", help="When using Supabase, send to all users instead of a single user")
    parser.add_argument("--use_supabase", action="store_true", help="Fetch recipient email from Supabase (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)")
    parser.add_argument("--auto", action="store_true", dest="auto", help="Fetch latest sensor data and alert all Supabase users when below threshold")
    parser.add_argument("--supabase_url", help="Supabase URL (overrides SUPABASE_URL env)")
    parser.add_argument("--supabase_service_role_key", help="Supabase service role key")
    parser.add_argument("--supabase_email", help="If provided, use this Supabase user email instead of fetching latest")
    parser.add_argument("--supabase_user_id", help="Supabase user id (uid). If provided, fetch that user's email")
    parser.add_argument("--fetch-latest-sensor", action="store_true", dest="fetch_latest_sensor", help="Fetch latest sensor_logs.water_level from Supabase and use it as --distance")
    parser.add_argument("--poll", action="store_true", help="Run in polling mode")
    parser.add_argument("--interval", type=float, default=3.0, help="Polling interval in seconds (default 3.0)")
    args = parser.parse_args()
    if args.auto:
        args.fetch_latest_sensor = True
        args.use_supabase = True
        args.send_all = True

    # 2. Extract variables from Environment (loaded via .env)
    gmail_user = args.gmail_user or os.getenv("GMAIL_USER")
    gmail_app_password = args.gmail_app_password or os.getenv("GMAIL_APP_PASSWORD")
    supabase_url = args.supabase_url or os.getenv("SUPABASE_URL")
    service_role = args.supabase_service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    to_email = args.to or os.getenv("ALERT_TO")
    threshold = args.threshold if args.threshold is not None else float(os.getenv("ALERT_THRESHOLD", "20"))

    if args.fetch_latest_sensor:
        if not supabase_url or not service_role:
            print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for sensor fetch")
            return 1
        try:
            args.distance = fetch_latest_water_level(supabase_url, service_role)
            if args.distance is None:
                print("No sensor data found in Supabase.")
                return 0
            print(f"Fetched latest sensor distance: {args.distance}")
        except Exception as e:
            print("Error fetching latest sensor data:", e)
            traceback.print_exc()
            return 1

    if args.distance is None and not args.use_supabase:
        print("ERROR: Missing distance. Provide --distance or --fetch-latest-sensor or use --use_supabase.")
        return 1

    if not gmail_user or not gmail_app_password or (not to_email and not args.use_supabase and not args.send_all):
        print("ERROR: Missing required Gmail credentials or recipient. Provide:")
        print("  GMAIL_USER, GMAIL_APP_PASSWORD, ALERT_TO (or --to), or use --use_supabase")
        return 1

    if args.use_supabase and (not supabase_url or not service_role):
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Supabase lookup")
        return 1

    def run_check_once() -> int:
        try:
            if args.use_supabase:
                if args.supabase_email:
                    local_to = args.supabase_email
                elif args.supabase_user_id:
                    try:
                        hdrs = {"apikey": service_role, "Authorization": f"Bearer {service_role}"}
                        user_endpoint = f"{supabase_url.rstrip('/')}/auth/v1/admin/users/{args.supabase_user_id}"
                        resp = requests.get(user_endpoint, headers=hdrs, timeout=30)
                        resp.raise_for_status()
                        candidate = resp.json()
                        local_to = candidate.get("email") if isinstance(candidate, dict) else None
                        if not local_to:
                            print("Supabase user has no email or could not be found")
                            return 1
                        print(f"Using Supabase user email: {local_to}")
                    except Exception as e:
                        print("Error fetching user from Supabase:", e)
                        traceback.print_exc()
                        return 1
                else:
                    try:
                        hdrs = {"apikey": service_role, "Authorization": f"Bearer {service_role}"}
                        users_endpoint = f"{supabase_url.rstrip('/')}/auth/v1/admin/users"
                        resp = requests.get(users_endpoint, headers=hdrs, timeout=30)
                        resp.raise_for_status()
                        users = resp.json()
                        if isinstance(users, dict) and "users" in users:
                            users_list = users["users"]
                        elif isinstance(users, list):
                            users_list = users
                        else:
                            users_list = []

                        if not users_list:
                            print("No users found in Supabase")
                            return 1

                        users_list.sort(key=lambda u: u.get("created_at"), reverse=True)

                        if args.send_all:
                            try:
                                emails = fetch_all_user_emails(supabase_url, service_role)
                            except Exception as e:
                                print("Error fetching approved user emails:", e)
                                traceback.print_exc()
                                return 1
                            if not emails:
                                print("No user emails available to send to")
                                return 1
                            if args.distance is not None and float(args.distance) <= float(threshold):
                                for email in emails:
                                    try:
                                        send_email_gmail(
                                            subject="WARNING: Water Level is too HIGH",
                                            body=("WARNING: Water Level is too HIGH. You need to evacuate immediately.\n\n"
                                                  f"Measured water level: {args.distance}\nThreshold: {threshold}\n"),
                                            gmail_user=gmail_user,
                                            gmail_app_password=gmail_app_password,
                                            to_email=email,
                                            from_email=args.from_email,
                                            dry_run=args.dry_run,
                                        )
                                        print(f"Sent to {email}")
                                    except Exception as ex:
                                        print(f"Failed to send to {email}: {ex}")
                            else:
                                print(f"No email: distance {args.distance} > {threshold}")
                            return 0
                        else:
                            candidate = users_list[0]
                            local_to = candidate.get("email")
                            if not local_to:
                                print("Latest Supabase user has no email field")
                                return 1
                            print(f"Using Supabase user email: {local_to}")
                    except Exception as e:
                        print("Error fetching users from Supabase:", e)
                        traceback.print_exc()
                        return 1
            else:
                local_to = to_email

            sent = check_and_alert(args.distance, threshold, gmail_user, gmail_app_password, local_to, args.from_email, dry_run=args.dry_run)
            if sent:
                print(f"Email sent to {local_to} (distance {args.distance} <= {threshold})")
                return 0
            else:
                print(f"No email: distance {args.distance} > {threshold}")
                return 0

        except Exception as e:
            print(f"Critical Error: {e}")
            traceback.print_exc()
            return 1

    # Polling support
    if getattr(args, "poll", False):
        interval = float(getattr(args, "interval", 3.0))
        if interval <= 0:
            interval = 3.0
        print(f"Polling every {interval} seconds. Press Ctrl+C to stop.")
        try:
            while True:
                if args.fetch_latest_sensor or args.auto or args.use_supabase:
                    try:
                        args.distance = fetch_latest_water_level(supabase_url, service_role)
                        if args.distance is None:
                            print("No sensor data found in Supabase.")
                        else:
                            print(f"Fetched latest sensor distance: {args.distance}")
                    except Exception as e:
                        print("Error fetching latest sensor data:", e)
                        traceback.print_exc()
                run_check_once()
                time.sleep(interval)
        except KeyboardInterrupt:
            print("Polling stopped by user")
            return 0

    return run_check_once()

if __name__ == "__main__":
    import sys
    sys.exit(main())