#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- WiFi Credentials ---
const char* ssid = "Angel";
const char* pass = "03781489";

// --- Supabase Config ---
const char* SUPABASE_URL    = "https://<YOUR_PROJECT_ID>.supabase.co";
const char* SUPABASE_ANON_KEY = "<YOUR_ANON_KEY>";
const char* DEVICE_ID       = "esp32-sensor-01"; // Unique ID for this device

// --- Pin Definitions ---
#define TRIG_PIN    5
#define ECHO_PIN    21
#define LED_PIN     2
#define BUZZER_PIN  4

// --- State ---
bool isEmergencyActive = false;
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 5000; // Send to Supabase every 5 seconds

// -------------------------------------------------------------------
// Upsert current water level into device_state (one row per device)
// -------------------------------------------------------------------
void upsertDeviceState(int waterLevel) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/device_state";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "resolution=merge-duplicates"); // Upsert behavior

  StaticJsonDocument<128> doc;
  doc["device_id"]   = DEVICE_ID;
  doc["water_level"] = waterLevel;
  // updated_at is handled automatically by Supabase if you set a default

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("[Supabase] device_state upsert -> HTTP %d\n", code);
  http.end();
}

// -------------------------------------------------------------------
// Append a new row to sensor_logs
// -------------------------------------------------------------------
void logSensorData(int waterLevel) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/sensor_logs";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);

  StaticJsonDocument<128> doc;
  doc["device_id"]   = DEVICE_ID;
  doc["water_level"] = waterLevel;
  // created_at defaults to now() on the Supabase side

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("[Supabase] sensor_logs insert -> HTTP %d\n", code);
  http.end();
}

// -------------------------------------------------------------------
// Read ultrasonic sensor and handle alerts
// -------------------------------------------------------------------
void checkDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH);
  if (duration == 0) return;

  int distance = duration * 0.034 / 2;
  Serial.printf("Distance: %d cm\n", distance);

  // --- Emergency alert (LED + buzzer) ---
  if (distance > 0 && distance < 25) {
    if (!isEmergencyActive) {
      Serial.println("!!! EMERGENCY: Water level too high !!!");
      isEmergencyActive = true;
    }
    tone(BUZZER_PIN, 3000);
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  } else {
    noTone(BUZZER_PIN);
    digitalWrite(LED_PIN, LOW);
    isEmergencyActive = false;
  }

  // --- Send to Supabase on interval ---
  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = now;
    upsertDeviceState(distance);
    logSensorData(distance);
  }
}

// -------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Starting GreenPulse (Supabase) ---");

  pinMode(TRIG_PIN,   OUTPUT);
  pinMode(ECHO_PIN,   INPUT);
  pinMode(LED_PIN,    OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  WiFi.begin(ssid, pass);
  Serial.print("Connecting to WiFi");
  int timeout = 0;
  while (WiFi.status() != WL_CONNECTED && timeout < 20) {
    delay(500);
    Serial.print(".");
    timeout++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi timed out. Running in Offline Mode.");
  }
}

void loop() {
  checkDistance();
  delay(200);
}