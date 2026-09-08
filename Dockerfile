# SVI DigiCash - Multi-stage Docker Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
# COPY docs/ ./docs/  # Optional - comment out if not present

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Add non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# Docs are served at runtime by the Docs tab
COPY docs/ ./docs/

# NOTE: config.env is NOT copied on purpose (it's gitignored and may not
# exist on fresh clones). Runtime config comes from docker-compose
# env_file/environment. For plain `docker run`, pass -e flags instead.

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => {process.exit(res.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/index.js"]