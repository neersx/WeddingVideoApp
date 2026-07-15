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

## Temporarily disable Google login

For local development only, set this in the mobile `.env` and the local backend environment:

```env
EXPO_PUBLIC_DISABLE_GOOGLE_AUTH=true
DISABLE_GOOGLE_AUTH=true
DEV_USER_EMAIL=local-dev@invitavideos.test
```

Restart Expo and the backend after changing the values. Never enable this on a public or production server.
