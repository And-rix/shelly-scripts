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
  
  // Title for the smartphone lock screen
  let title = allOk ? "✅ Internet Check: OK" : "⚠️ Internet Check: FAILED";
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
    timeout: 10
  }, function (res, err) {
    if (res && res.code === 200) {
      print("✅ ntfy successfully sent (Response 200).");
    } else {
      print("🔴 ntfy failed. Code: " + (res ? res.code : "N/A"));
    }
  });
}

// === Single Connectivity Check ===
function checkConnectionOnce() {
  let failedUrls = [];
  let completed = 0;
  let totalCount = urls.length;

  print("🔍 Checking " + totalCount + " URLs...");

  urls.forEach(function (url) {
    Shelly.call("HTTP.GET", { url: url, timeout: 5000 }, function (res, err) {
      completed++;

      if (err || res.code !== 200) {
        failedUrls.push(url);
        print("🔴 Failed: " + url);
      } else {
        print("🟢 OK: " + url);
      }

      // Once all requests are finished
      if (completed === totalCount) {
        let reachedCount = totalCount - failedUrls.length;
        let messageBody = "Status: " + reachedCount + "/" + totalCount + " URLs reached.\n";

        if (failedUrls.length === 0) {
          messageBody += "🟢 Connection is stable.";
        } else {
          messageBody += "\n🔴 Failed addresses:\n- " + failedUrls.join("\n- ");
        }

        sendNtfy(messageBody, failedUrls.length, totalCount);
      }
    });
  });
}

// === Start ===
print("📡 Starting Internet Checker...");
checkConnectionOnce();