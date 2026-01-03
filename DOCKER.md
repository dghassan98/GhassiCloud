# GhassiCloud Docker Deployment Guide

This guide explains how to deploy GhassiCloud using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

## Quick Start (Development)

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd GhassiCloud
   ```

2. **Start the development environment:**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Production Deployment

### Option 1: Simple Deployment (HTTP only)

1. **Create environment file (optional):**
   ```bash
   # Create .env file
   echo GHASSICLOUD_PORT=8090 > .env
   
   # Or set a persistent JWT secret to avoid regeneration on restart:
   echo JWT_SECRET=$(openssl rand -base64 64) >> .env
   ```

2. **Build and start:**
   ```bash
   docker-compose up -d --build
   ```

3. **Access the application:**
   - http://localhost:8090 (or your server IP:8090)

### Option 2: Production with HTTPS (Caddy Reverse Proxy)

1. **Build and start:**
   ```bash
   docker-compose up -d --build
   ```

2. **Add to your Caddyfile:**
   ```caddyfile
   ghassicloud.yourdomain.com {
       reverse_proxy localhost:8090
   }
   ```

3. **Reload Caddy:**
   ```bash
   sudo systemctl reload caddy
   ```

4. **Access the application:**
   - https://ghassicloud.yourdomain.com

## Docker Commands

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop services
```bash
docker-compose down
```

### Stop and remove volumes (⚠️ deletes data)
```bash
docker-compose down -v
```

### Rebuild after code changes
```bash
docker-compose up -d --build
```

### Check service status
```bash
docker-compose ps
```

### Access container shell
```bash
# Backend
docker exec -it ghassicloud-backend sh

# Frontend
docker exec -it ghassicloud-frontend sh
```

## Data Persistence

- **SQLite Database**: Stored in a Docker volume `backend_data`
- **SSL Certificates** (production): Stored in `traefik_certs` volume

### Backup Database
```bash
# Create backup
docker cp ghassicloud-backend:/app/data/ghassicloud.db ./backup-$(date +%Y%m%d).db

# Restore backup
docker cp ./backup.db ghassicloud-backend:/app/data/ghassicloud.db
docker-compose restart backend
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens (auto-generated if not set) | Auto-generated |
| `JWT_EXPIRES_IN` | JWT token expiration | `365d` (1 year) |
| `GHASSICLOUD_PORT` | Port for Caddy to proxy to | `8090` |

**Note:** If you don't set `JWT_SECRET`, one will be auto-generated. However, it will change on each restart, logging out all users. For production, set a persistent secret in `.env`.

## Caddyfile Configuration

Add this block to your existing Caddyfile:

```caddyfile
ghassicloud.yourdomain.com {
    reverse_proxy localhost:8090
}
```

Caddy will automatically handle HTTPS certificates via Let's Encrypt.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Network                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │   Frontend   │────▶│   Backend    │                  │
│  │   (Nginx)    │     │   (Node.js)  │                  │
│  │   Port 80    │     │   Port 3001  │                  │
│  └──────────────┘     └──────────────┘                  │
│         │                    │                           │
│         │                    ▼                           │
│         │             ┌──────────────┐                  │
│         │             │   SQLite DB   │                  │
│         │             │   (Volume)    │                  │
│         │             └──────────────┘                  │
│         │                                                │
└─────────│────────────────────────────────────────────────┘
          │ :8090
          ▼
   ┌──────────────┐
   │    Caddy     │  (Your existing reverse proxy)
   │   Port 443   │
   └──────────────┘
```

## Troubleshooting

### Container won't start
```bash
# Check logs for errors
docker-compose logs backend
docker-compose logs frontend
```

### Database issues
```bash
# Check if volume exists
docker volume ls | grep ghassicloud

# Inspect volume
docker volume inspect ghassicloud_backend_data
```

### Port already in use
```bash
# Change the port in .env
GHASSICLOUD_PORT=8091
```

### SSL certificate issues
```bash
# Check Caddy logs
sudo journalctl -u caddy -f

# Verify DNS is pointing to server
dig +short yourdomain.com

# Test Caddy config
caddy validate --config /etc/caddy/Caddyfile
```

## Updating

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Rebuild and restart:**
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

## Security Recommendations

1. **Always change the default JWT_SECRET**
2. **Use HTTPS in production** (use `docker-compose.prod.yml`)
3. **Regularly update Docker images**
4. **Backup your database regularly**
5. **Use a firewall to restrict access**

## License

MIT License - See LICENSE file for details.
