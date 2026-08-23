# Live Location Tracer - Native Mobile Application

A cross-platform **React Native & Expo** mobile application with **24/7 background location tracking** support.

## Features
- **24/7 Background Tracking**: Leverages `expo-location` and `expo-task-manager` to stream GPS coordinates even when the app is minimized, closed, or the device is rebooted.
- **Android Foreground Service**: Displays a sticky system notification to guarantee uninterrupted location streaming in the background.
- **WebSocket + HTTP Streaming**: Real-time Socket.IO streaming with HTTP `POST /weather` fallback.
- **Custom Backend Endpoint**: Easily set your local server IP (`http://192.168.x.x:6589`) or Cloudflare Tunnel URL directly from the app interface.
- **Professional UI/UX**: Dark slate and cyan theme with real-time telemetry gauges and system diagnostic log feed.

## Prerequisites
- Node.js (v18+)
- Expo CLI (`npx expo`)
- Mobile device with **Expo Go** installed (available on Google Play Store & iOS App Store).

## Quick Start Guide

### 1. Install Dependencies
Navigate to the `mobile-app` directory and install packages:
```bash
cd mobile-app
npm install
```

### 2. Launch the Development Server
```bash
npx expo start
```

### 3. Run on Mobile Device
- Open **Expo Go** on your physical Android or iOS device.
- Scan the QR code displayed in your terminal.

### 4. Enable 24/7 Background Tracking
1. Open the app on your device.
2. Ensure your backend server is running (`npm start` in the root folder).
3. Set your backend URL in the **Server Endpoint URL** input (e.g. `https://core-pairs-street-others.trycloudflare.com`).
4. Toggle the **24/7 Background Service** switch to ON.
5. When prompted by Android/iOS, grant location permissions and select **"Allow all the time"**.

## Building Native Standalone APKs
To build a standalone Android `.apk` file using Expo Application Services (EAS Build):
```bash
npx eas build --platform android --profile preview
```
