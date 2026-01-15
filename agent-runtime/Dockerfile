FROM node:20-slim

# Install dependencies for potential browser automation
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
    && rm -rf /var/lib/apt/lists/*

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

CMD ["npm", "start"]
