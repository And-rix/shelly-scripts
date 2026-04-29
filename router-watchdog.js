// router-watchdog.js
// MIT License
// Copyright (c) 2026 And-rix
// GitHub: https://github.com/And-rix
// License: /LICENSE

// === Configuration ===
let reboot_delay = 15;               		  // Seconds router stays powered off
let check_interval = 60;             		  // Seconds between connectivity checks
let max_failures = 5;                		  // Number of failed checks before reboot
let recovery_wait = 300;             		  // Seconds to wait after reboot before checking
let max_retries_after_reboot = 10;   		  // Max retries after reboot before rebooting again
let post_reboot_retry_delay = 60;    		  // Seconds between retries after reboot

// === ntfy Configuration ===
let enable_ntfy_notify = true;         		// true = enabled; false = disabled
let ntfy_topic = "PLACEHOLDER-TOPIC"; 		// Your ntfy topic
let ntfy_priority = "4";               		// 1-5 (5 is most urgent)

// === URL list for connectivity checks ===
let urls = [
  "http://example.com",
  "http://neverssl.com",
  "http://captive.apple.com"
];

// === State variables ===
let fail_count = 0;
let post_reboot_retry_count = 0;
let waiting_for_recovery = false;
let last_successful_uptime = 0;
let router_rebooted = false;  // Flag to indicate that a reboot occurred

// === Helper: System uptime and pass to callback ===
function getUptime(callback) {
  Shelly.call("Sys.GetStatus", {}, function (res) {
    if (res && typeof res.uptime === "number") {
      callback(res.uptime);
    } else {
      callback(0);
    }
  });
}

// === Helper: Update last successful check uptime ===
function updateLastSuccessfulUptime() {
  getUptime(function(uptime) {
    last_successful_uptime = uptime;
  });
}

// === Send ntfy notification ===
function sendNotification(message) {
  if (!enable_ntfy_notify) return;
  
  Shelly.call("HTTP.POST", { 
    url: "https://ntfy.sh/" + ntfy_topic, 
    body: message, 
    timeout: 10000, // Increased timeout to 10s
    headers: {
        "Title": "Shelly Router Watchdog",
        "Priority": ntfy_priority,
        "Tags": "electric_plug,white_check_mark"
    } 
  }, function(res, err) {
    // Check for HTTP 200 even if the Shelly internal 'err' is present
    if (res && res.code === 200) {
      print("🟢 ntfy notification sent successfully (Response 200).");
    } else {
      print("🔴 Failed to send ntfy notification. Code: " + (res ? res.code : "N/A"));
    }
  });
}

// === Check URLs sequentially (stop if first success) ===
function checkUrlsSerial(index, onComplete) {
  if (index >= urls.length) {
    // No URL succeeded
    return onComplete(false);
  }

  Shelly.call("http.get", { url: urls[index], timeout: 5000 }, function (res, err) {
    if (!err && res.code === 200) {
      onComplete(true);
    } else {
      checkUrlsSerial(index + 1, onComplete);
    }
  });
}

// === Main function: Check internet connection ===
function checkConnection() {
  if (waiting_for_recovery) {
    // Skip checks while waiting for recovery
    return;
  }

  checkUrlsSerial(0, function(success) {
    if (success) {
      print("🟢 Internet check OK");
      fail_count = 0;
      updateLastSuccessfulUptime();
    } else {
      fail_count++;
      print("🔴 Internet check failed. Fail count:", fail_count);

      if (fail_count >= max_failures) {
        print("🔌 Max failures reached – rebooting router.");
        rebootRouter();
      }
    }
  });
}

// === Reboot router: power off, wait, power on ===
function rebootRouter() {
  waiting_for_recovery = true;
  router_rebooted = true; // Mark that a reboot is in progress
  print("🔌 Powering off router for", reboot_delay, "seconds.");
  Shelly.call("Switch.Set", { id: 0, on: false });

  Timer.set(reboot_delay * 1000, false, function () {
    Shelly.call("Switch.Set", { id: 0, on: true });
    print("⚡ Router powered back on.");

    Timer.set(recovery_wait * 1000, false, function () {
      print("🔍 Checking internet after reboot...");
      postRebootCheck();
    });
  });
}

// === Post reboot: repeatedly check connection, reboot again if needed ===
function postRebootCheck() {
  checkUrlsSerial(0, function(success) {
    if (success) {
      print("🟢 Internet back online after reboot.");
      waiting_for_recovery = false;
      fail_count = 0;
      post_reboot_retry_count = 0;
      updateLastSuccessfulUptime();
      
      // Send a notification if a reboot occurred
      if (router_rebooted) {
        let message = "🟢 Router was rebooted and internet is online!";
        sendNotification(message);
        router_rebooted = false; // Reset the flag
      }
    } else {
      post_reboot_retry_count++;
      print("🔴 Internet still down after reboot. Attempt:", post_reboot_retry_count);

      if (post_reboot_retry_count >= max_retries_after_reboot) {
        print("🔁 Max retries reached – rebooting router again.");
        post_reboot_retry_count = 0;
        rebootRouter();
      } else {
        Timer.set(post_reboot_retry_delay * 1000, false, postRebootCheck);
      }
    }
  });
}

// === Script Watchdog: restart script if no successful check for a while ===
function setupWatchdog() {
  Timer.set(check_interval * 1000 * 5, true, function () {  // 5x check_interval threshold
    getUptime(function(currentUptime) {
      if ((currentUptime - last_successful_uptime) > (check_interval * 5)) {
        print("⚠️ No successful internet check for a while. Restarting script...");
        Shelly.call("Script.Restart", { id: Shelly.getCurrentScriptId() });
      }
    });
  });
}

// === Initialization ===
print("📡 Shelly Router Watchdog started.");
updateLastSuccessfulUptime();
Timer.set(check_interval * 1000, true, checkConnection);
setupWatchdog();