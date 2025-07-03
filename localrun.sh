#!/bin/bash

# Exit on any error
set -e

echo "🔧 Installing dependencies..."
npm install

echo "📦 Building action with ncc..."
npm run package

act -W .github/workflows/test.yml --secret-file .secrets
