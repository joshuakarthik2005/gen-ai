# Multi-stage build for Next.js application
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first for better Docker layer caching
# These files are copied from the build context (frontend directory) to /app in container
COPY package.json package-lock.json* ./

# Install dependencies (including dev dependencies needed for build)
RUN npm ci --only=production=false

# Copy all application source code
COPY . .

# Set environment variables for build and runtime
ENV NEXT_PUBLIC_API_URL=https://legal-backend-144935064473.asia-south1.run.app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
RUN npm run build

# Expose the port that Next.js runs on
EXPOSE 3000

# Start the Next.js application in production mode
CMD ["npm", "start"]