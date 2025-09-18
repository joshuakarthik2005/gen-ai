# Use Python base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables (excluding PORT which is set by Cloud Run)
ENV PYTHONUNBUFFERED=1

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies with verbose output
RUN pip install --no-cache-dir --verbose -r requirements.txt

# Copy all application files
COPY . .

# Expose port (Cloud Run will set the PORT env var automatically)
EXPOSE 8080

# Use Cloud Run's PORT environment variable
CMD exec uvicorn api:app --host 0.0.0.0 --port ${PORT:-8080}