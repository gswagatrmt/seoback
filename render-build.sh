#!/bin/bash
set -o errexit

# Universal Chrome install directory
CHROME_DIR=${CHROME_DIR:-/tmp/chrome}

if [[ ! -d "$CHROME_DIR/opt/google/chrome" ]]; then
  echo "Downloading Google Chrome..."
  mkdir -p "$CHROME_DIR"
  cd "$CHROME_DIR"

  # Download stable Chrome
  wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

  # Extract Chrome without requiring sudo
  dpkg -x google-chrome-stable_current_amd64.deb "$CHROME_DIR"

  rm google-chrome-stable_current_amd64.deb

  chmod +x "$CHROME_DIR/opt/google/chrome/chrome"
  echo "Chrome installed at $CHROME_DIR/opt/google/chrome/chrome"
else
  echo "Using cached Chrome at $CHROME_DIR"
fi

# Export the Puppeteer Chrome path
export CHROMIUM_PATH="$CHROME_DIR/opt/google/chrome/chrome"
export PATH="$PATH:$CHROME_DIR/opt/google/chrome"

echo "Chrome path set!"
