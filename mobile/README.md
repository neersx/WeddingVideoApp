# InvitaVideos mobile app

This is an Expo React Native client for the existing InvitaVideos API. It includes category and template selection, category-aware details, multi-photo upload, music filtering, Google sign-in, render polling, and an in-app video preview.

## Run locally

```bash
cd mobile
npm install
cp .env.example .env
npm start
```

Then press `i` for the iOS simulator, `a` for Android, or scan the QR code with Expo Go. The default API is `https://invitavideos.com/api`; set `EXPO_PUBLIC_API_URL` to use a local backend (for a physical phone, use your computer's LAN IP, not `localhost`).

Google sign-in needs the same OAuth client configuration as the web app. Set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` and, when applicable, platform-specific `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` in `.env`.
