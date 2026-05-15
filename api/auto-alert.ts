import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
const threshold = Number(process.env.ALERT_THRESHOLD ?? "20");

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.");
}
if (!gmailUser || !gmailAppPassword) {
  throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variable.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: gmailUser,
    pass: gmailAppPassword,
  },
});

async function fetchLatestWaterLevel() {
  const { data, error } = await supabase
    .from("sensor_logs")
    .select("water_level")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    throw error;
  }
  return data?.water_level ?? null;
}

async function fetchAlertUserEmails() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("role", "user");

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data.map((row) => row.email).filter(Boolean) : [];
}

async function sendAlertEmails(emails: string[], waterLevel: number) {
  const subject = "URGENT: Flood Alert — Water Level Too High";
  const body = `WARNING: Water Level is too HIGH.\n\nMeasured water level: ${waterLevel}\nThreshold: ${threshold}\n\nPlease move to higher ground immediately.`;

  const results = [];
  for (const email of emails) {
    try {
      await transporter.sendMail({
        from: gmailUser,
        to: email,
        subject,
        text: body,
      });
      results.push({ email, status: "sent" });
    } catch (error) {
      results.push({ email, status: "error", message: String(error) });
    }
  }
  return results;
}

export default async function handler(req, res) {
  try {
    const method = req.method?.toUpperCase() ?? "GET";
    let waterLevel = null;

    if (method === "POST" && req.body?.distance != null) {
      waterLevel = Number(req.body.distance);
    } else {
      waterLevel = await fetchLatestWaterLevel();
    }

    if (waterLevel == null) {
      return res.status(200).json({ message: "No sensor data available." });
    }

    if (waterLevel > threshold) {
      return res.status(200).json({
        message: "Water level is safe.",
        waterLevel,
        threshold,
      });
    }

    const emails = await fetchAlertUserEmails();
    if (!emails.length) {
      return res.status(200).json({ message: "No recipients found.", waterLevel });
    }

    const results = await sendAlertEmails(emails, waterLevel);
    return res.status(200).json({
      message: "Alert processed.",
      waterLevel,
      threshold,
      recipients: emails.length,
      results,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: String(error) });
  }
}
