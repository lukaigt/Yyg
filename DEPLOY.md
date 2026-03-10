# VideoForge - VPS Deployment Guide

## Prerequisites
- Docker and Docker Compose installed on your VPS
- Git installed

## Quick Start

1. Clone the repo:
```bash
git clone https://github.com/YOUR_USERNAME/videoforge.git
cd videoforge
```

2. Create your environment file:
```bash
cp .env.example .env
```

3. Edit `.env` and add your OpenRouter API key:
```
OPENROUTER_API_KEY=your_key_here
PORT=3000
```

4. Start the app:
```bash
docker compose up -d
```

5. Access at `http://your-vps-ip:3000`

## Updating

When you push new code to GitHub:
```bash
git pull
docker compose up -d --build
```

## Data Persistence

Your data is stored in two directories that are mounted as Docker volumes:
- `storage/` - uploaded assets and rendered videos
- `db/` - SQLite database file

These persist across container rebuilds.

## Reverse Proxy (Optional)

To use a domain name with HTTPS, set up Nginx or Caddy as a reverse proxy:

### Caddy (easiest)
```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

- **Chromium errors**: Make sure Docker has enough memory (at least 2GB recommended)
- **Render fails**: Check logs with `docker compose logs -f`
- **Large file uploads**: If using Nginx, increase `client_max_body_size`
