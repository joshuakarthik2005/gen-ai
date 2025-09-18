# Use Python base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables early
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies with verbose output
RUN pip install --no-cache-dir --verbose -r requirements.txt

# Copy all application files
COPY . .

# Expose port
EXPOSE 8080

# Simple startup command
CMD exec uvicorn api:app --host 0.0.0.0 --port $PORT