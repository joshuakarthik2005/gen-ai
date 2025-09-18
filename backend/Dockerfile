# Use Python base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app files (exclude sensitive files)
COPY api.py .
COPY demystifier.py .
COPY *.txt .

# Create a non-root user
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# Expose port for Cloud Run
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start app with uvicorn
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]