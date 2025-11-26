#!/bin/bash
set -o errexit

# Define a location for Chromium installation (using /tmp for cloud environments like Render)
CHROME_DIR=${CHROME_DIR:-/tmp/chrome}

# Fetch the latest Chromium snapshot version
SNAPSHOT_URL="https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/LAST_CHANGE"
LATEST=$(wget -qO- "$SNAPSHOT_URL")

if [[ -z "$LATEST" ]]; then
  echo "Unable to fetch latest snapshot number" >&2
  exit 1
fi

TAR_URL="https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/${LATEST}/chrome-linux.zip"

# Create the install directory and download Chromium
if [[ ! -d "$CHROME_DIR" ]]; then
  echo "Creating a writable Chrome directory at $CHROME_DIR"
  mkdir -p "$CHROME_DIR"
  cd "$CHROME_DIR"

  # Download and unzip Chromium binary
  wget -q --show-progress "$TAR_URL" -O chromium-snapshot.zip
  unzip -q chromium-snapshot.zip
  rm chromium-snapshot.zip

  # Ensure the binary is executable
  chmod +x chrome-linux/chrome

  echo "Chromium installed at $CHROME_DIR/chrome-linux/chrome"
else
  echo "Using cached Chromium at $CHROME_DIR"
fi

# Export the correct path for the executable (ensure Puppeteer or the audit tool uses this path)
export CHROMIUM_PATH="$CHROME_DIR/chrome-linux/chrome"
export PATH="$PATH:$CHROME_DIR/chrome-linux"

echo "Chromium path set to $CHROMIUM_PATH"
