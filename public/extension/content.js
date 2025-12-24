// Poly Extension - Injects "Ask Poly" button on Polymarket and Kalshi
(function () {
  "use strict";

  console.log("🔮 Poly Extension loaded on", window.location.href);

  const POLY_URL = "https://usevera.tech";
  const MAX_RETRIES = 30;
  const RETRY_DELAY = 300;
  let currentUrl = window.location.href;
  let injectionInProgress = false;

  // Detect which platform we're on
  function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes("polymarket.com")) return "polymarket";
    if (hostname.includes("kalshi.com")) return "kalshi";
    return null;
  }

  // Get ALL h1 elements and pick the best one
  function findBestTitle(platform) {
    const allH1s = document.querySelectorAll("h1");
    console.log(`🔍 Found ${allH1s.length} h1 elements on page`);

    for (let i = 0; i < allH1s.length; i++) {
      const h1 = allH1s[i];
      const text = h1.textContent.trim();
      console.log(`  h1[${i}]: "${text.substring(0, 60)}..." (${text.length} chars)`);

      // Skip very short titles
      if (text.length < 10) continue;

      // For Kalshi, prefer titles with "?" or longer text
      if (platform === "kalshi" && (text.includes("?") || text.length > 20)) {
        console.log(`  ✅ Selected this h1 as title`);
        return h1;
      }

      // For Polymarket, first reasonable h1
      if (platform === "polymarket" && text.length > 15) {
        console.log(`  ✅ Selected this h1 as title`);
        return h1;
      }
    }

    // Fallback: return first h1 with decent length
    for (const h1 of allH1s) {
      if (h1.textContent.trim().length > 10) {
        console.log(`  ⚠️ Using fallback h1`);
        return h1;
      }
    }

    return null;
  }

  // Check if we're on a market page
  function isMarketPage(platform) {
    const path = window.location.pathname;

    if (platform === "polymarket") {
      const isMarket = path.includes("/event/") || path.includes("/market/");
      console.log(`📍 Polymarket market page check: ${isMarket} (path: ${path})`);
      return isMarket;
    }

    if (platform === "kalshi") {
      const isMarket = path.includes("/markets/") || path.includes("/events/");
      console.log(`📍 Kalshi market page check: ${isMarket} (path: ${path})`);
      return isMarket;
    }

    return false;
  }

  // Remove existing buttons
  function removeExistingButton() {
    const existing = document.querySelectorAll(".poly-extension-container");
    if (existing.length > 0) {
      console.log(`🗑️ Removing ${existing.length} existing button(s)`);
      existing.forEach((button) => button.remove());
    }
  }

  // Inject Poly button
  function injectPolyButton(retryCount = 0) {
    if (injectionInProgress && retryCount === 0) {
      console.log("⏸️ Injection already in progress, skipping");
      return;
    }

    injectionInProgress = true;

    const platform = detectPlatform();

    if (!platform) {
      console.log("❌ Not on a supported platform");
      injectionInProgress = false;
      return;
    }

    console.log(`🎯 Injection attempt ${retryCount + 1}/${MAX_RETRIES} on ${platform}`);

    // Check if we're on a market page
    if (!isMarketPage(platform)) {
      console.log("ℹ️ Not on a market page, skipping injection");
      injectionInProgress = false;
      return;
    }

    // Check if button already exists
    const existingButton = document.querySelector(".poly-extension-button");
    if (existingButton) {
      console.log("✅ Button already exists, skipping");
      injectionInProgress = false;
      return;
    }

    // Find title
    const titleSection = findBestTitle(platform);

    if (!titleSection) {
      if (retryCount < MAX_RETRIES) {
        console.log(`⏳ Title not found, retrying in ${RETRY_DELAY}ms...`);
        setTimeout(() => {
          injectionInProgress = false;
          injectPolyButton(retryCount + 1);
        }, RETRY_DELAY);
      } else {
        console.log("💀 Max retries reached, giving up");
        injectionInProgress = false;
      }
      return;
    }

    console.log("✨ Creating button...");

    const marketUrl = encodeURIComponent(window.location.href);

    // Create button container
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "poly-extension-container";

    // Create Ask Poly button (green)
    const askButton = document.createElement("a");
    askButton.className = "poly-extension-button";
    askButton.href = `${POLY_URL}?market=${marketUrl}&platform=${platform}`;
    askButton.target = "_blank";
    askButton.rel = "noopener noreferrer";
    askButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Ask Poly</span>
    `;

    buttonContainer.appendChild(askButton);

    // Insert after title
    if (titleSection.parentNode) {
      titleSection.parentNode.insertBefore(buttonContainer, titleSection.nextSibling);
      console.log("🎉 Button injected successfully!");
    } else {
      console.log("❌ Could not find parent node");
    }

    injectionInProgress = false;
  }

  // Main handler
  function handleInjection(source = "unknown") {
    console.log(`\n🚀 handleInjection triggered by: ${source}`);
    removeExistingButton();
    setTimeout(() => injectPolyButton(0), 150);
  }

  // === IMMEDIATE EXECUTION ===
  console.log("⚡ Starting immediate injection");
  handleInjection("initial-load");

  // === METHOD 1: URL Polling ===
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      console.log("🔄 URL changed detected by polling");
      currentUrl = window.location.href;
      handleInjection("url-polling");
    }
  }, 500);

  // === METHOD 2: History API ===
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function () {
    originalPushState.apply(this, arguments);
    handleInjection("pushState");
  };

  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    handleInjection("replaceState");
  };

  // === METHOD 3: PopState ===
  window.addEventListener("popstate", () => {
    handleInjection("popstate");
  });

  // === METHOD 4: Load Event ===
  window.addEventListener("load", () => {
    handleInjection("window-load");
  });

  // === METHOD 5: DOMContentLoaded ===
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      handleInjection("DOMContentLoaded");
    });
  }

  // === METHOD 6: Multiple delayed attempts ===
  [500, 1000, 2000, 3000].forEach((delay) => {
    setTimeout(() => {
      if (!document.querySelector(".poly-extension-button")) {
        console.log(`⏰ Delayed injection attempt at ${delay}ms`);
        handleInjection(`delayed-${delay}ms`);
      }
    }, delay);
  });

  // === METHOD 7: DOM Observer ===
  const observer = new MutationObserver(() => {
    const platform = detectPlatform();
    if (!platform || !isMarketPage(platform)) return;

    const hasButton = document.querySelector(".poly-extension-button");
    const hasTitle = findBestTitle(platform);

    if (hasTitle && !hasButton && !injectionInProgress) {
      console.log("👁️ DOM observer triggered injection");
      handleInjection("dom-observer");
    }
  });

  setTimeout(() => {
    observer.observe(document.body, {
      subtree: true,
      childList: true,
    });
    console.log("👁️ DOM observer started");
  }, 1000);

  console.log("✅ All injection methods registered\n");
})();