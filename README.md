# InvitaVideos run guide

The application has four services:

- `backend`: FastAPI API on port `8001`
- `render-service`: Remotion renderer on port `4001`
- `frontend`: React web app on port `3000` during development
- `mobile`: Expo Android and iOS app

## Local development

The backend loads `backend/.env.development` by default. The web and mobile
development commands load their development environment variables.

Install and start the render service:

```bash
cd render-service
npm install --legacy-peer-deps
npm run start
```

In another terminal, install and start the backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
APP_ENV=development .venv/bin/uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

In another terminal, start the web app:

```bash
cd frontend
npm install --legacy-peer-deps
npm start
```

To start the Expo mobile app:

```bash
cd mobile
npm install
npm start
```

Press `a` for Android or `i` for the iOS simulator. When testing on a physical
phone, the development API URL must use the computer's LAN address rather than
`localhost`.

## Production

The backend loads `backend/.env.production` when `APP_ENV=production`. Variables
provided by systemd, Docker, or the hosting platform override values in the file.

Start the production backend:

```bash
cd backend
APP_ENV=production .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
```

Start the production render service:

```bash
cd render-service
npm install --legacy-peer-deps
npm run start
```

Create the production web build:

```bash
cd frontend
npm install --legacy-peer-deps
npm run build
```

Create Android and iOS production builds with the EAS `production` environment:

```bash
cd mobile
eas build --platform android --profile production
eas build --platform ios --profile production
```

Configure the mobile `EXPO_PUBLIC_*` production values in the Expo project
dashboard under **Environment variables → production**. Local `.env.production`
files are gitignored and are not uploaded to remote EAS builders.

Do not commit backend secrets or OAuth client secrets. Configure them through
the production host's environment-variable or secret-management settings.

For the complete Ubuntu, Nginx, TLS, and systemd deployment procedure, see
[`deploy/README.md`](deploy/README.md).
