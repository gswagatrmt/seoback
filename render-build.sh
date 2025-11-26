#!/bin/bash
set -o errexit

CHROME_DIR=${CHROME_DIR:-/tmp/chrome}

# Get latest snapshot number for Linux 64‑bit
SNAPSHOT_URL="https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/LAST_CHANGE"
LATEST=$(wget -qO- "$SNAPSHOT_URL")

if [[ -z "$LATEST" ]]; then
  echo "Unable to fetch latest snapshot number" >&2
  exit 1
fi

TAR_URL="https://commondatastorage.googleapis.com/chromium-browser-snapshots/Linux_x64/${LATEST}/chrome-linux.zip"

if [[ ! -d "$CHROME_DIR" ]]; then
  echo "Downloading Chromium snapshot ${LATEST}..."
  mkdir -p "$CHROME_DIR"
  cd "$CHROME_DIR"

  wget -q --show-progress "$TAR_URL" -O chromium‑snapshot.zip
  unzip -q chromium‑snapshot.zip
  rm chromium‑snapshot.zip

  # the binary will be inside something like chrome-linux/chrome
  chmod +x chrome-linux/chrome

  echo "Chromium installed at $CHROME_DIR/chrome-linux/chrome"
else
  echo "Using cached Chromium at $CHROME_DIR"
fi

export CHROMIUM_PATH="$CHROME_DIR/chrome-linux/chrome"
export PATH="$PATH:$CHROME_DIR/chrome-linux"

echo "Chromium path set: $CHROMIUM_PATH"
