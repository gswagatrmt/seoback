#!/bin/bash
set -o errexit

# Define the Chromium install directory
CHROME_DIR=${CHROME_DIR:-/tmp/chrome}

# Install lightweight Chromium browser
if [[ ! -d "$CHROME_DIR/opt/chromium" ]]; then
  echo "Installing Chromium..."
  mkdir -p "$CHROME_DIR"
  cd "$CHROME_DIR"

  # Install dependencies for Chromium
  apt-get update
  apt-get install -y chromium-browser \
    libnss3 \
    libxss1 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libasound2 \
    libx11-xcb1 \
    libxtst6 \
    libnss3-dev \
    libgdk-pixbuf2.0-dev \
    libdbus-glib-1-2

  echo "Chromium installed at $CHROME_DIR"
else
  echo "Using cached Chromium at $CHROME_DIR"
fi

# Export the path for Chromium to use with Puppeteer
export CHROMIUM_PATH="/usr/bin/chromium-browser"
export PATH="$PATH:/usr/bin"

echo "Chromium path set!"
