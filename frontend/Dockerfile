# Use the official Node.js image  
FROM node:18-alpine

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy all application source
COPY . .

# Set environment variables
ENV NEXT_PUBLIC_API_URL=https://legal-backend-144935064473.asia-south1.run.app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Change ownership and switch to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]