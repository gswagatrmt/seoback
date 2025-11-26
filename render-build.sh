#!/bin/bash
set -o errexit

# Universal Chrome/Chromium install directory
CHROME_DIR=${CHROME_DIR:-/tmp/chrome}

# Define a lightweight Chromium version URL
CHROMIUM_URL="https://download-chromium.appspot.com/download?platform=linux64"

if [[ ! -d "$CHROME_DIR" ]]; then
  echo "Downloading Chromium..."

  # Create Chrome directory if not exists
  mkdir -p "$CHROME_DIR"
  cd "$CHROME_DIR"

  # Download Chromium tarball (lightweight version)
  wget -q --no-check-certificate "$CHROMIUM_URL" -O chromium.tar.xz

  # Extract the tarball
  tar -xf chromium.tar.xz --strip-components=1

  # Remove the tarball to save space
  rm chromium.tar.xz

  # Make Chromium executable
  chmod +x "$CHROME_DIR/chrome"

  echo "Chromium installed at $CHROME_DIR/chrome"
else
  echo "Using cached Chromium at $CHROME_DIR"
fi

# Export the Chromium path for Puppeteer
export CHROMIUM_PATH="$CHROME_DIR/chrome"
export PATH="$PATH:$CHROME_DIR"

echo "Chromium path set!"
