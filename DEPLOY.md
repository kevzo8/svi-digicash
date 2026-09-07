# SVI DigiCash - EC2 Deployment Guide

## Server Information

| Detail | Value |
|--------|-------|
| **Public IP** | `18.246.254.97` |
| **Private IP** | `172.31.59.230` |
| **Region** | us-east-1 (N. Virginia) |
| **OS** | Amazon Linux 2023 |

---

## DigiCash Whitelisting Info

**Give DigiCash Support:**

```
Whitelist IP: 18.246.254.97
Callback URL: http://18.246.254.97:3000/api/callback
```

**After HTTPS setup:**
```
Callback URL: http://18.246.254.97/api/callback  (via nginx on port 80)
```

---

## Quick Deploy (One Command from Local)

```bash
# From your local machine - copy and deploy
scp -r svi-digicash ec2-user@18.246.254.97:~/
ssh ec2-user@18.246.254.97 "cd ~/svi-digicash && chmod +x deploy.sh && ./deploy.sh"
```

---

## Manual Deploy Steps

### 1. Connect to EC2
```bash
ssh ec2-user@18.246.254.97
```

### 2. Install Docker & Docker Compose
```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Log out and back in for group changes
exit
ssh ec2-user@18.246.254.97

# Install Docker Compose v2
sudo curl -SL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker compose version
```

### 3. Copy Project & Configure
```bash
# Project already copied via scp above
cd ~/svi-digicash

# Verify .env has production credentials
cat .env
```

**Required .env variables:**
```env
DIGICASH_SERVICE_ID=service.svi
DIGICASH_PASSWORK=passw0rd@SVI
DIGICASH_SECRET_KEY=dl)m38(0BDyXhPJpLH)T!Rz|E?,v[<
DIGICASH_BASE_URL=https://api.fastpayph.com
CALLBACK_URL=http://18.246.254.97:3000/api/callback
RETURN_URL=http://18.246.254.97:3000/payment/return
PORT=3000
NODE_ENV=production
```

### 4. Build & Run
```bash
docker compose build --no-cache
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

### 5. Verify Deployment
```bash
# Health check
curl http://18.246.254.97:3000/api/health

# Expected response:
# {"status":"ok","service":"SVI DigiCash","timestamp":"..."}

# Frontend
curl http://18.246.254.97:3000

# Callback endpoint test
curl -X POST http://18.246.254.97:3000/api/callback \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

---

## Post-Deploy Verification Checklist

- [ ] `docker compose ps` shows `Up (healthy)`
- [ ] `curl http://18.246.254.97:3000/api/health` returns 200 OK
- [ ] Frontend loads at `http://18.246.254.97:3000`
- [ ] Callback endpoint accepts POST requests
- [ ] DigiCash can reach callback URL (test after whitelisting)

---

## Production: Nginx Reverse Proxy (Port 80/443)

```bash
# Start with nginx profile
docker compose --profile production up -d

# Verify nginx is running
docker compose ps

# Test via nginx (port 80)
curl http://18.246.254.97/api/health
curl http://18.246.254.97/api/callback -X POST -H "Content-Type: application/json" -d '{}'
```

**Update DigiCash callback URL to:**
```
http://18.246.254.97/api/callback
```

---

## Auto-Start on Reboot (Systemd)

```bash
# Install systemd service
sudo cp ~/svi-digicash/svi-digicash.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable svi-digicash
sudo systemctl start svi-digicash

# Check status
sudo systemctl status svi-digicash

# View logs
sudo journalctl -u svi-digicash -f
```

---

## Firewall Configuration

```bash
# Allow port 3000 (direct access)
sudo firewall-cmd --permanent --add-port=3000/tcp

# Allow HTTP/HTTPS (nginx)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-all
```

---

## SSL/HTTPS Setup (Let's Encrypt)

```bash
# Install certbot
sudo yum install -y certbot

# Get certificate (replace with your domain)
sudo certbot certonly --standalone -d your-domain.com

# Certificates will be at:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# Update nginx.conf with SSL config, then reload:
docker compose exec nginx nginx -s reload
```

---

## Useful Commands

| Action | Command |
|--------|---------|
| View logs | `docker compose logs -f` |
| Restart app | `docker compose restart digicash` |
| Stop all | `docker compose down` |
| Rebuild & deploy | `docker compose up -d --build` |
| View container status | `docker compose ps` |
| Enter container | `docker compose exec digicash sh` |
| Systemd logs | `journalctl -u svi-digicash -f` |

---

## Troubleshooting

### Container won't start
```bash
docker compose logs digicash
# Check .env file exists and has correct values
```

### Port 3000 not accessible
```bash
# Check security group in AWS Console allows port 3000
# Check firewall-cmd allows port 3000
sudo firewall-cmd --list-ports
```

### Callback not receiving
```bash
# Test locally on EC2
curl -X POST http://localhost:3000/api/callback -H "Content-Type: application/json" -d '{"test":true}'

# Check DigiCash whitelisted 18.246.254.97
# Check callback URL matches exactly: http://18.246.254.97:3000/api/callback
```

### Update Application
```bash
cd ~/svi-digicash
git pull  # or copy new files
docker compose up -d --build
```

---

## File Locations on EC2

| File | Path |
|------|------|
| Project | `~/svi-digicash/` |
| Docker Compose | `~/svi-digicash/docker-compose.yml` |
| Environment | `~/svi-digicash/.env` |
| Systemd Service | `/etc/systemd/system/svi-digicash.service` |
| Nginx Config | `~/svi-digicash/nginx.conf` |
| Deploy Script | `~/svi-digicash/deploy.sh` |
| Application Logs | `docker compose logs` / `journalctl -u svi-digicash` |

---

## Support Contacts

- **DigiCash Support**: For API credentials, whitelisting, callback issues
- **AWS EC2**: For security groups, networking, instance issues
- **Application Logs**: `docker compose logs -f digicash`