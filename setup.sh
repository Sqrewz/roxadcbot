#!/usr/bin/env bash
# Setup for the stream community bot on Debian-based home servers (incl. CasaOS).
# Run with:  bash setup.sh
set -e

# Use the current user's home instead of assuming /home/ubuntu
RUN_USER="${USER:-$(whoami)}"
RUN_HOME="$HOME"

echo "==> Updating packages..."
sudo apt-get update -y
sudo apt-get install -y ffmpeg git curl ca-certificates gnupg build-essential

echo "==> Installing Node.js 20 (LTS)..."
if command -v node >/dev/null 2>&1 && [ "$(node -v | cut -d. -f1 | tr -d 'v')" -ge 18 ]; then
  echo "Node $(node -v) already installed, skipping."
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Getting the bot code..."
cd "$RUN_HOME"
if [ -d roxadcbot ]; then
  echo "roxadcbot already exists, pulling latest..."
  cd roxadcbot && git pull
else
  git clone https://github.com/Sqrewz/roxadcbot.git
  cd roxadcbot
fi

echo "==> Installing npm dependencies (may take a few minutes)..."
npm ci || npm install

echo "==> Creating .env from template if missing..."
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || touch .env
  echo "!! .env created/empty."
fi

echo "==> Installing pm2 (keeps the bot alive & restarts on reboot)..."
sudo npm install -g pm2
pm2 start index.js --name bot
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u "$RUN_USER" --hp "$RUN_HOME"

echo ""
echo "=================================================="
echo "DONE. Bot is running under pm2."
echo ""
echo "Next steps:"
echo "  1. Edit the secrets:"
echo "     nano $RUN_HOME/roxadcbot/.env"
echo "  2. pm2 restart bot"
echo "  3. pm2 logs bot   <- watch logs"
echo "  4. Make sure no other instance (Replit) is using the same token."
echo "=================================================="