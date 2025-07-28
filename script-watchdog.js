// MIT License
// Copyright (c) 2025 And-rix
// GitHub: https://github.com/And-rix
// License: /LICENSE

// === Configuration ===
let monitored_script_id = 2;            // ID of the script to monitor
let check_interval_sec = 60;           // Check interval in seconds

// === Telegram Configuration ===
let enable_telegram_notify = false;    // true = enabled; false = disabled
let telegram_token = "123456:ABCDEF-YourTokenHere";
let telegram_chat_id = "123456789";    // Group chats: starts with -

// === Send Telegram Notification ===
function sendTelegramNotification(message) {
  if (!enable_telegram_notify) return;

  let url = "https://api.telegram.org/bot" + telegram_token + "/sendMessage";
  let payload = {
    chat_id: telegram_chat_id,
    text: message
  };

  Shelly.call("http.post", {
    url: url,
    body: JSON.stringify(payload),
    timeout: 5000,
    headers: { "Content-Type": "application/json" }
  }, function (res, err) {
    if (!err) {
      print("✅ Telegram notification sent.");
    } else {
      print("❌ Failed to send Telegram notification.");
    }
  });
}

// === Check function ===
function checkScriptStatus() {
  Shelly.call("Script.GetStatus", { id: monitored_script_id }, function (res, err) {
    if (err) {
      print("❌ Error querying script ID", monitored_script_id);
      return;
    }

    if (res.running === false) {
      print("⚠️ Script ID", monitored_script_id, "is not running – starting it...");
      Shelly.call("Script.Start", { id: monitored_script_id }, function (startRes, startErr) {
        if (startErr) {
          print("❌ Error starting script ID", monitored_script_id);
        } else {
          print("✅ Script ID", monitored_script_id, "was successfully started");

          // Send notification after successful recovery
          sendTelegramNotification("🛠️ Script ID " + monitored_script_id + " was not running and has been restarted by the monitor.");
        }
      });
    } else {
      print("✅ Script ID", monitored_script_id, "is running fine.");
    }
  });
}

// === Init ===
print("🔎 Script Monitor started (monitoring ID", monitored_script_id, ")");
Timer.set(check_interval_sec * 1000, true, checkScriptStatus);
