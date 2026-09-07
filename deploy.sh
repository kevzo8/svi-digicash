#!/bin/bash
# SVI DigiCash - Simple EC2 Deploy
# Run from ~/svi-digicash on EC2

set -e

echo "🚀 SVI DigiCash Deploy"
echo "======================"

# Install Docker if needed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    sudo yum update -y && sudo yum install -y docker
    sudo systemctl start docker && sudo systemctl enable docker
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. Please re-login and re-run this script."
    exit 0
fi

# Install Docker Compose if needed
if ! docker compose version &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -SL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Build and run
echo "🔨 Building..."
docker compose build --no-cache

echo "🚀 Starting..."
docker compose up -d

echo "⏳ Waiting for health check..."
sleep 10

docker compose ps

PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s ifconfig.me)

echo ""
echo "✅ Done!"
echo "🌐 Frontend:     http://${PUBLIC_IP}:3000"
echo "🔗 Callback:     http://${PUBLIC_IP}:3000/api/callback"
echo "❤️  Health:       http://${PUBLIC_IP}:3000/api/health"
echo ""
echo "📋 Logs: docker compose logs -f"
echo "🔄 Restart: docker compose restart"