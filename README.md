# AI Check — Chrome Extension

Detect AI-generated images with one click. A tiny "Check?" button appears on every image — click it to see if it's AI-generated.

## Features

- 🔍 Scans all images on any webpage (≥100×100px)
- 🤖 One-click AI detection via Sightengine
- 🎨 Color-coded results: 🟢 Not AI → 🟡 Possibly AI → 🟠 Likely AI → 🔴 Surely AI
- 📊 Shows probability percentage, not just a verdict
- 🆓 3 free checks per day
- ⚡ Lightweight — no impact on page performance

## Install (Development)

1. Clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right)
4. Click **Load unpacked** → select this folder
5. Browse any website — "Check?" buttons appear on images!

## Setup

Before using, update `background.js` line 3 with your backend URL:

```js
const BACKEND_URL = 'https://your-vercel-backend.vercel.app';
```

The backend repo: [ai-check-backend](https://github.com/franciumm/ai-check-backend)

## How It Works

```
User clicks "Check?" → content.js → background.js → Backend API → Sightengine
                                                          ↓
              content.js shows label ← background.js ← { score, label }
```

## Score Thresholds

| Score | Label | Color |
|-------|-------|-------|
| < 25% | Not AI | 🟢 Green |
| 25-75% | Possibly AI | 🟡 Yellow |
| 75-90% | Likely AI | 🟠 Orange |
| > 90% | Surely AI | 🔴 Red |

## Tech Stack

- Chrome Manifest V3
- Vanilla JavaScript (zero dependencies)
- Sightengine genai API (via backend proxy)

## License

MIT
