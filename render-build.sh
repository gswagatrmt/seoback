#!/bin/bash
set -o errexit

# Universal Chromium install directory
CHROME_DIR=${CHROME_DIR:-/tmp/chrome}

# Fetch the latest Chromium snapshot version
SNAPSHOT_URL="https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/LAST_CHANGE"
LATEST=$(wget -qO- "$SNAPSHOT_URL")

# Check if we got the latest snapshot version number
if [[ -z "$LATEST" ]]; then
  echo "Unable to fetch latest snapshot number" >&2
  exit 1
fi

# Construct the download URL for the latest snapshot
TAR_URL="https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/${LATEST}/chrome-linux.zip"

# Check if the Chromium directory already exists, if not, create it and download Chromium
if [[ ! -d "$CHROME_DIR" ]]; then
  echo "Creating a writable Chromium directory at $CHROME_DIR"
  mkdir -p "$CHROME_DIR"
  cd "$CHROME_DIR"

  # Download and unzip Chromium binary
  echo "Downloading Chromium snapshot from: $TAR_URL"
  wget -q --show-progress "$TAR_URL" -O chromium-snapshot.zip
  unzip -q chromium-snapshot.zip
  rm chromium-snapshot.zip

  # Ensure the binary is executable
  chmod +x chrome-linux/chrome
  echo "Chromium installed at $CHROME_DIR/chrome-linux/chrome"
else
  echo "Using cached Chromium at $CHROME_DIR"
fi

# Export the correct path for the executable
export CHROMIUM_PATH="$CHROME_DIR/chrome-linux/chrome"
export PATH="$PATH:$CHROME_DIR/chrome-linux"

# Debugging: Confirm the environment variable is set correctly
echo "CHROMIUM_PATH is set to: $CHROMIUM_PATH"

# Debugging: Verify the Chromium binary is executable
echo "Verifying if Chromium binary is executable..."
if [[ -x "$CHROMIUM_PATH" ]]; then
  echo "Chromium binary is executable."
else
  echo "Chromium binary is NOT executable. Attempting to fix permissions."
  chmod +x "$CHROMIUM_PATH"
  echo "Permissions fixed, verifying again..."
  if [[ -x "$CHROMIUM_PATH" ]]; then
    echo "Chromium binary is now executable."
  else
    echo "Failed to set execute permissions on Chromium binary." >&2
    exit 1
  fi
fi

# Debugging: Check the PATH variable to ensure it's correct
echo "Current PATH: $PATH"

# Test the Chromium binary to ensure it works by checking its version
echo "Testing Chromium version..."
"$CHROMIUM_PATH" --version

echo "Chromium installation completed and verified!"
