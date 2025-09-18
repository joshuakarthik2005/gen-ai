# Use Python base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables (Cloud Run will provide PORT automatically)
ENV PYTHONUNBUFFERED=1

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY . .

# Cloud Run will automatically set PORT, we just need to listen on it
CMD exec uvicorn api:app --host 0.0.0.0 --port $PORT