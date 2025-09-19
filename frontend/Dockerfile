# Use the official Node.js image  
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Node.js packages
RUN apk add --no-cache libc6-compat

# Copy package files first for better Docker layer caching
# When using `cd frontend && gcloud run deploy --source .`, 
# the build context is the frontend directory
COPY package.json package-lock.json ./

# Install dependencies (including dev dependencies needed for build)
RUN npm ci

# Copy all source code
COPY . .

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