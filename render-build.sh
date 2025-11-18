#!/bin/bash
# exit on error
set -o errexit

STORAGE_DIR=/opt/render/project/.render

if [[ ! -d $STORAGE_DIR/chrome ]]; then
  echo "...Downloading Chrome"
  mkdir -p $STORAGE_DIR/chrome
  cd $STORAGE_DIR/chrome
  wget -P ./ https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  dpkg -x ./google-chrome-stable_current_amd64.deb $STORAGE_DIR/chrome
  rm ./google-chrome-stable_current_amd64.deb
  cd $HOME/project/src # Make sure we return to where we were

  # Check if the binary exists after installation
  if [[ -f $STORAGE_DIR/chrome/opt/google/chrome/chrome ]]; then
    echo "...Chrome successfully installed."
  else
    echo "...Error: Chrome binary not found!"
    exit 1
  fi

  # Fix permissions: make the Chrome binary executable
  chmod +x $STORAGE_DIR/chrome/opt/google/chrome/chrome

  # Debugging: Check the permissions of the Chrome binary
  echo "Checking permissions of the Chrome binary:"
  ls -l $STORAGE_DIR/chrome/opt/google/chrome/chrome

else
  echo "...Using Chrome from cache"
fi

# Set Chrome path for Puppeteer to use
export PATH="${PATH}:$STORAGE_DIR/chrome/opt/google/chrome"
