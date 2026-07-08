FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ffmpeg fonts-noto-color-emoji \
    libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile --production=false

COPY tsconfig.json ./
COPY src ./src

RUN npx remotion browser ensure

ENV PORT=4001

EXPOSE 4001
CMD ["yarn", "start"]
