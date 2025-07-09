// === Configuration ===
let reboot_delay = 15;              // Seconds the router will be powered off
let check_interval = 60;            // Seconds between connectivity checks
let max_failures = 5;               // Number of failed checks before triggering a reboot
let recovery_wait = 300;            // Seconds to wait after powering the router back on
let max_retries_after_reboot = 10;  // Max number of checks after reboot before rebooting again

let urls = [
  "http://example.com",
  "http://neverssl.com",
  "http://one.one.one.one"
];

// === Telegram Configuration ===
let telegram_token = "123456:ABCDEF-YourTokenHere";  // Replace with your bot token
let telegram_chat_id = "123456789";                  // Replace with your chat ID (group-chats: starting with -)

// === Status variables ===
let fail_count = 0;
let waiting_for_recovery = false;
let post_reboot_retry_count = 0;

// === Telegram Send Function ===
function sendTelegram(message) {
  let url = "https://api.telegram.org/bot" + telegram_token + "/sendMessage";
  let payload = {
    chat_id: telegram_chat_id,
    text: message
  };

  print("📨 Sending Telegram message:", message);

  Shelly.call("http.post", {
    url: url,
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    timeout: 7000
  }, function (res, err) {
    if (err) {
      print("❌ Telegram Error:", JSON.stringify(err));
    } else {
      print("✅ Telegram Response:", JSON.stringify(res));
    }
  });
}

// === Check internet connection (regular cycle) ===
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

// === Turn off router, power back on, and recheck internet ===
function rebootRouter() {
  waiting_for_recovery = true;
  print("🔌 Internet down – restarting router...");

  Shelly.call("Switch.Set", { id: 0, on: false });

  Timer.set(reboot_delay * 1000, false, function () {
    Shelly.call("Switch.Set", { id: 0, on: true });
    print("⚡ Router powered on");

    Timer.set(recovery_wait * 1000, false, function () {
      print("🔍 Checking internet after reboot...");
      checkConnectionPostReboot();
    });
  });
}

// === Recheck internet after reboot ===
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
          print("✅ Internet is back!");
          fail_count = 0;
          waiting_for_recovery = false;
          post_reboot_retry_count = 0;

          Timer.set(30000, false, function () {
            sendTelegram("🔁 Router restarted. 🌐 Internet is back online.");
          });

        } else {
          post_reboot_retry_count++;
          print("❌ Still no internet after reboot. Attempt:", post_reboot_retry_count);

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

// === Start regular checks ===
print("📡 Shelly Watchdog started...");
Timer.set(check_interval * 1000, true, checkConnection);
