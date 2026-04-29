// url-test.js
// MIT License
// Copyright (c) 2026 And-rix
// GitHub: https://github.com/And-rix
// License: /LICENSE

// === ntfy Configuration ===
let ntfy_topic = "PLACEHOLDER-TOPIC";       // Your ntfy topic placeholder
let ntfy_priority = "3";                    // Default priority

// === URL List for Connectivity Check ===
let urls = [
  "http://example.com",
  "http://neverssl.com",
  "http://captive.apple.com"
];

// === Send ntfy Notification ===
function sendNtfy(message, failedCount, totalCount) {
  let url = "https://ntfy.sh/" + ntfy_topic;
  let allOk = (failedCount === 0);
  
  let title = allOk ? "✅ Internet Check: All OK" : "⚠️ Internet Check: " + failedCount + " Failed";
  let tags = allOk ? "white_check_mark" : "warning,dns";
  let priority = allOk ? ntfy_priority : "4";

  print("📨 Sending ntfy notification...");

  Shelly.call("HTTP.POST", {
    url: url,
    body: message,
    headers: { 
        "Title": title,
        "Priority": priority,
        "Tags": tags
    },
    timeout: 10 // Timeout slightly increased to 10s
  }, function (res, err) {
    // Check if we got a 200 OK response, even if 'err' is triggered
    if (res && res.code === 200) {
      print("✅ ntfy successfully sent (Response 200).");
    } else {
      print("🔴 ntfy truly failed or timed out. Code: " + (res ? res.code : "N/A"));
    }
  });
}

// === Single Connectivity Check ===
function checkConnectionOnce() {
  let failedUrls = [];
  let completed = 0;

  print("🔍 Checking " + urls.length + " URLs...");

  urls.forEach(function (url) {
    Shelly.call("HTTP.GET", { url: url, timeout: 5000 }, function (res, err) {
      completed++;

      if (err || res.code !== 200) {
        failedUrls.push(url);
        print("🔴 Failed: " + url);
      } else {
        print("🟢 OK: " + url);
      }

      // Once all requests are finished (success or failure)
      if (completed === urls.length) {
        let messageBody = "";

        if (failedUrls.length === 0) {
          messageBody = "🟢 All " + urls.length + " test URLs reachable.";
        } else {
          messageBody = "🔴 Could NOT be reached:\n- " + failedUrls.join("\n- ");
        }

        sendNtfy(messageBody, failedUrls.length, urls.length);
      }
    });
  });
}

// === Start ===
print("📡 Starting Internet Checker...");
checkConnectionOnce();