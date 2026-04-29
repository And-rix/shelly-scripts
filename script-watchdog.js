// script-watchdog.js
// MIT License
// Copyright (c) 2026 And-rix
// GitHub: https://github.com/And-rix
// License: /LICENSE

// === Configuration ===
let monitored_script_id = 1;            	// ID of the script to monitor
let check_interval_sec = 60;           		// Check interval in seconds

// === ntfy Configuration ===
let enable_ntfy_notify = true;         	  // true = enabled; false = disabled
let ntfy_topic = "PLACEHOLDER-TOPIC"; 	  // Your ntfy topic
let ntfy_priority = "4";               		// 1-5 (4 = High)

// === Send ntfy Notification (Optimized) ===
function sendNotification(message) {
  if (!enable_ntfy_notify) return;

  Shelly.call("HTTP.POST", {
    url: "https://ntfy.sh/" + ntfy_topic,
    body: message,
    timeout: 10000,
    headers: {
      "Title": "Shelly Script Monitor",
      "Priority": ntfy_priority,
      "Tags": "mag,refresh"
    }
  }, function (res, err) {
    // Optimized check: HTTP 200 means success even if 'err' is reported
    if (res && res.code === 200) {
      print("🟢 ntfy notification sent successfully.");
    } else {
      print("🔴 Failed to send ntfy notification. Code: " + (res ? res.code : "N/A"));
    }
  });
}

// === Check function ===
function checkScriptStatus() {
  Shelly.call("Script.GetStatus", { id: monitored_script_id }, function (res, err) {
    if (err) {
      print("🔴 Error querying script ID " + monitored_script_id);
      return;
    }

    if (res.running === false) {
      print("⚠️ Script ID " + monitored_script_id + " is NOT running – starting it...");
      
      Shelly.call("Script.Start", { id: monitored_script_id }, function (startRes, startErr) {
        if (startErr) {
          print("🔴 Error starting script ID " + monitored_script_id);
        } else {
          print("🟢 Script ID " + monitored_script_id + " was successfully started");

          // Send notification after successful recovery
          let msg = "🟢 Script ID " + monitored_script_id + " was stopped and has been restarted by the monitor.";
          sendNotification(msg);
        }
      });
    } else {
      print("🟢 Script ID " + monitored_script_id + " is running fine.");
    }
  });
}

// === Init ===
print("🔎 Script Monitor started (monitoring ID: " + monitored_script_id + ")");
Timer.set(check_interval_sec * 1000, true, checkScriptStatus);