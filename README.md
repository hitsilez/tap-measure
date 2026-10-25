# Tape Measure Explorer 📏

An interactive, 100% offline-ready Progressive Web App (PWA) and Android app designed to teach anyone—including 10-year-olds—how to read both metric and imperial markings on a tape measure.

---

## ✨ Features

- **Realistic Two-Sided Tape Measure Blade:**
  - Continuous horizontal yellow steel blade with a 3D curved gradient highlight.
  - Realistic metal end hook with rivets and a slotted nail-grab hole.
  - Dark heavy-duty housing case with red rubberized accent stripe and length indicator.
  - Quick identification label on the blade: `cm ▲ inch ▼`.
- **Dual Metric & Imperial Precision Marking:**
  - **Metric (Top Edge):** Millimeters, half-centimeters (5 mm), centimeters, 5 cm, and 10 cm bold red marks, plus bright red meter badges (`1 m`, `2 m`, `3 m`).
  - **Imperial (Bottom Edge):** 1/16″, 1/8″, 1/4″, 1/2″, and 1″ ticks with height hierarchy, red foot markings (`1 ft`, `2 ft`), and red diamonds (♦) marking 16-inch wall stud centers.
- **Adaptive Density & Culling:**
  - High-performance 60fps rendering using HTML5 `<canvas>`. Only visible sections of the tape are drawn.
  - Tick levels automatically adjust based on zoom: sub-ticks only appear when there are at least 3 pixels between lines to prevent moiré visual clutter.
  - Labels adapt dynamically so numbers never collide or overlap at any zoom level.
- **Smooth Navigation & Zoom:**
  - Slide/drag the tape with momentum inertia.
  - Multi-touch pinch-to-zoom on touchscreens and trackpads.
  - Mouse wheel zoom focused on the pointer.
  - On-screen zoom buttons, logarithmic zoom slider, position scrubber, and "Whole Tape" button.
  - Full keyboard shortcuts: `<kbd>←</kbd>` / `<kbd>→</kbd>` to pan, `<kbd>+</kbd>` / `<kbd>-</kbd>` to zoom, `<kbd>Home</kbd>` to reset view.
- **"Where Is What" Dual Readout:**
  - Click or tap anywhere to drop a cyan pin (snapped to the nearest millimeter) with an instant measurement flag.
  - Hovering on desktop displays a dashed preview indicator with live tracking.
  - **Metric Card:** Big cm display (e.g. `25.4 cm`), millimeters (`254 mm`), and meters + cm (`0 m 25.4 cm`).
  - **Imperial Card:** Whole inches + reduced fractional inches (e.g. `14 11/16 in`), feet + inches (`1 ft 2 11/16 in`), decimal inches (`14.688″`), and exactness indicator (`Exact 1/16″` or `Nearest 1/16″`).
  - **Interactive 1/16th Fraction Bar:** Visual 16-segment breakdown showing exactly which fraction of an inch the pin rests on.
  - Starts by default at **25.4 cm = 10 inches exact** to illustrate the fundamental metric/imperial link!
- **Jump To / "Find It":**
  - Type any number, decimal (e.g., `25.4`), or mixed fraction (e.g., `5 3/8`, `14 11/16`), pick a unit (`cm`, `mm`, `m`, `in`, `ft`), and click **Find It**.
  - The tape smoothly animates to center the target, zooms in, and pins the position.
- **Adjustable Tape Length:**
  - Quick presets: 1 m, 2 m, 3 m, 5 m, 8 m, 10 m, 10 ft, 16 ft, 25 ft, 30 ft.
  - Custom length selector between 0.3 m and 30 m with unit conversion equivalence.
- **Learning Tips for Beginners & Kids:**
  - Explains red diamonds (16″ stud spacing in construction).
  - Explains the tick height hierarchy (1/16 to 1 inch).
  - Explains why the metal hook is intentionally loose by 1/16″ (1.6 mm) to compensate for its own thickness when pushing vs. pulling!
- **Zero External Dependencies:**
  - No CDNs, no external fonts, no external APIs.
  - Uses system font stack (`Arial Narrow`, `Roboto Condensed`, `sans-serif`) for authentic ruler numerals.
  - Works 100% offline after the initial load.

---

## 🚀 How to Host the Web App

Because Service Workers require a secure context, **HTTPS** (or `http://localhost`) is required for offline caching and installation.

### Option 1: Static Web Hosting (Recommended)
You can deploy the root files (`index.html`, `style.css`, `app.js`, `manifest.webmanifest`, `sw.js`, and `icons/`) to any static host:
- **GitHub Pages:**
  1. Push this repository to GitHub.
  2. Go to **Settings > Pages**.
  3. Under **Branch**, select `main` (or your default branch) and `/ (root)`, then click **Save**.
- **Netlify / Cloudflare Pages / Vercel / Firebase Hosting:**
  - Drag and drop the folder or connect your repository. Set build directory to `./` (no build step required).

### Option 2: Local Development Server
Run any lightweight static server:
```bash
# Python 3
python3 -m http.server 8000

# Node.js (npx)
npx serve .
```
Then navigate to `http://localhost:8000` in your web browser.

---

## 📱 How to Install as a PWA

### On Android (Chrome or Edge)
1. Open the hosted URL in Google Chrome.
2. Tap the **three-dot menu** in the top-right corner.
3. Select **Add to Home screen** or **Install app**.
4. The app icon will appear on your home screen and run standalone with full offline access!

### On iOS (Safari)
1. Open the hosted URL in Safari.
2. Tap the **Share** button (box with an arrow pointing up) at the bottom.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** in the top-right corner.

### On Desktop (Chrome, Edge, Brave)
1. Navigate to the hosted URL.
2. Click the **Install** icon on the right side of the URL address bar (or go to Menu > Save and share > Install Tape Measure Explorer).
3. The app opens in its own window and works fully offline.

---

## 🤖 Android Native App

This repository also contains a complete Android project powered by Jetpack Compose and an offline WebView wrapper:
- Bundled offline assets are located in `app/src/main/assets/www/`.
- Compile and build using standard Gradle:
  ```bash
  gradle :app:assembleDebug
  ```
- APK output will be in `app/build/outputs/apk/debug/app-debug.apk`.
