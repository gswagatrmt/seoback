#!/bin/bash
set -o errexit

echo "Using Puppeteer's bundled Chromium..."
export CHROMIUM_PATH=$(node -p "require('puppeteer').executablePath()")

echo "Chromium path: $CHROMIUM_PATH"
