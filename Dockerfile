# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Install build tools for native dependencies (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy sources and build
COPY . .
RUN npm run build

# Final stage
FROM node:22-alpine AS runtime

WORKDIR /app

# Install production dependencies and curl for health checks
# Also need build tools here if npm ci --omit=dev needs to rebuild native modules
RUN apk add --no-cache curl python3 make g++

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Copy build artifacts
COPY --from=build /app/dist ./dist

# Copy backend source files
# Note: Node 22 native TS stripping requires the .ts files at runtime
COPY --from=build /app/server.ts ./
COPY --from=build /app/database.ts ./
COPY --from=build /app/firebase-admin.ts ./
COPY --from=build /app/types.ts ./
COPY --from=build /app/firebase-applet-config.json ./
COPY --from=build /app/sqlite-init.sql ./

EXPOSE 3000

# Start the application using tsx for robust TypeScript execution
CMD ["npx", "tsx", "server.ts"]
