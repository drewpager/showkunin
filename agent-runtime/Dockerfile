FROM node:20-slim

# Install dependencies for browser automation (Playwright/Chromium)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    openssl \
    ca-certificates \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Playwright to use system Chromium
ENV DOCKER=true
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV DISPLAY=:99

WORKDIR /app

# Copy package files (build context should be project root)
COPY agent-runtime/package*.json ./
RUN npm install --ignore-scripts

# Copy Prisma schema from project root for client generation
COPY prisma/schema.prisma ./prisma/schema.prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY agent-runtime/src ./src
COPY agent-runtime/tsconfig.json ./

# Create non-root user for security
RUN useradd -m agent && chown -R agent:agent /app
USER agent

# Create workspace directory for agent execution
RUN mkdir -p /app/workspace

ENV NODE_ENV=production

# Start xvfb virtual display and then run the application
# Using exec ensures signals (SIGTERM, etc.) reach npm for graceful shutdown
CMD ["sh", "-c", "Xvfb :99 -screen 0 1920x1080x24 & exec npm start"]
