# Use Node.js Alpine image
FROM node:18-alpine


# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy all application files
COPY . .

# Set environment variables
ENV NEXT_PUBLIC_API_URL=https://legal-backend-820438968871.asia-south1.run.app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]