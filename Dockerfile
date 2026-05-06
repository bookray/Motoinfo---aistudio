# Build stage
FROM node:22-alpine AS build

WORKDIR /app

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
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

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
