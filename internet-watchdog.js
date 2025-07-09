// MIT License
// Copyright (c) 2025 And-rix
// GitHub: https://github.com/And-rix
// License: /LICENSE

// === Configuration ===
let reboot_delay = 15;              // Seconds the router stays powered off
let check_interval = 60;            // Seconds between checks
let max_failures = 5;               // Number of failed checks before reboot
let recovery_wait = 300;            // Seconds to wait after power on
let max_retries_after_reboot = 10;  // Number of retries after reboot before rebooting again

let urls = [
  "http://example.com",
  "http://neverssl.com",
  "http://one.one.one.one"
];

// === Status variables ===
let fail_count = 0;
let waiting_for_recovery = false;
let post_reboot_retry_count = 0;

// === Check internet connection (normal cycle) ===
function checkConnection() {
  if (waiting_for_recovery) return;

  let successful = false;
  let completed = 0;

  urls.forEach(function (url) {
    Shelly.call("http.get", { url: url, timeout: 5000 }, function (res, err) {
      completed++;
      if (!err && res.code === 200) {
        successful = true;
      }

      if (completed === urls.length) {
        if (successful) {
          print("✅ Internet OK");
          fail_count = 0;
        } else {
          fail_count++;
          print("❌ Failure count:", fail_count);

          if (fail_count >= max_failures && !waiting_for_recovery) {
            rebootRouter();
          }
        }
      }
    });
  });
}

// === Turn off router, turn it on again and check internet connection ===
function rebootRouter() {
  waiting_for_recovery = true;
  print("🔌 Internet lost – restarting router...");

  Shelly.call("Switch.Set", { id: 0, on: false });

  Timer.set(reboot_delay * 1000, false, function () {
    Shelly.call("Switch.Set", { id: 0, on: true });
    print("⚡ Router powered on again");

    Timer.set(recovery_wait * 1000, false, function () {
      print("🔍 Checking internet after reboot...");
      checkConnectionPostReboot();
    });
  });
}

// === Repeated check after reboot ===
function checkConnectionPostReboot() {
  let successful = false;
  let completed = 0;

  urls.forEach(function (url) {
    Shelly.call("http.get", { url: url, timeout: 5000 }, function (res, err) {
      completed++;
      if (!err && res.code === 200) {
        successful = true;
      }

      if (completed === urls.length) {
        if (successful) {
          print("✅ Internet available again!");
          fail_count = 0;
          waiting_for_recovery = false;
          post_reboot_retry_count = 0;
        } else {
          post_reboot_retry_count++;
          print("❌ Internet still unavailable after reboot. Attempt:", post_reboot_retry_count);

          if (post_reboot_retry_count >= max_retries_after_reboot) {
            print("🔁 Max retries reached – restarting router again...");
            post_reboot_retry_count = 0;
            rebootRouter();  // Restart again
          } else {
            Timer.set(60 * 1000, false, checkConnectionPostReboot);
          }
        }
      }
    });
  });
}

// === Start the regular checking ===
print("📡 Shelly Watchdog started...");
Timer.set(check_interval * 1000, true, checkConnection);
