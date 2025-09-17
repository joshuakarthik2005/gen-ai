#!/bin/bash

# GitHub Actions Setup Helper Script for Legal Document Demystifier
# This script helps you set up the GCP_SA_KEY GitHub secret

echo "=== GitHub Actions Setup Helper ==="
echo "This script will help you set up GitHub Actions for automatic deployment."
echo ""

# Check if service account key exists
SERVICE_KEY_PATH="backend/service-account-key.json"

if [ ! -f "$SERVICE_KEY_PATH" ]; then
    echo "❌ Error: Service account key not found at $SERVICE_KEY_PATH"
    echo "Please ensure the service account key file exists in the backend directory."
    exit 1
fi

echo "✅ Found service account key file"
echo ""

echo "=== Instructions to Set Up GitHub Secret ==="
echo ""
echo "1. Copy the service account key content:"
echo "   The key content will be displayed below. Copy it entirely."
echo ""
echo "2. Go to your GitHub repository:"
echo "   https://github.com/joshuakarthik2005/gen-ai"
echo ""
echo "3. Navigate to Settings > Secrets and variables > Actions"
echo ""
echo "4. Click 'New repository secret'"
echo ""
echo "5. Create a secret with:"
echo "   - Name: GCP_SA_KEY"
echo "   - Secret: (paste the content below)"
echo ""
echo "6. Save the secret"
echo ""
echo "=== SERVICE ACCOUNT KEY CONTENT ==="
echo "Copy everything between the lines below:"
echo "----------------------------------------"
cat "$SERVICE_KEY_PATH"
echo ""
echo "----------------------------------------"
echo ""
echo "✅ After setting up the GitHub secret, commit and push your changes."
echo "✅ GitHub Actions will automatically deploy your backend to Cloud Run!"