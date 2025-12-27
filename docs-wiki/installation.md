# Installation & Deployment

## 🐳 Docker (Recommended)

### Quick Start

```bash
git clone https://github.com/nguyenston/mokuro-library.git
cd mokuro-library
docker compose build
docker compose up -d
```

Access at `http://localhost:3001`

**Data storage:** `./data` (database) and `./data/uploads` (manga files)

### Updating

```bash
docker compose build
docker compose up -d --force-recreate
```

Database migrations run automatically. Your data in `./data` is preserved.

### Stopping

```bash
docker compose down              # Stop container
docker compose down -v           # Stop and delete all data
```

---

## 💻 Windows Portable

1. Download `MokuroLibrary-Windows.zip` from [Releases](https://github.com/nguyenston/mokuro-library/releases)
2. Extract and run `mokuro-library.exe`
3. Access at `http://localhost:3001`

**Updating:** Extract new version, copy `data` and `uploads` folders from old installation.

::: warning Database Compatibility
Windows Portable database uses `_app_migrations` and is **not compatible** with Docker version. Switching requires export/re-import or manual `prisma migrate resolve`.
:::

---

## 🛠️ Development

### Prerequisites
- Node.js v18+
- pnpm (recommended) or npm
- Git

### Setup

```bash
git clone https://github.com/nguyenston/mokuro-library.git
cd mokuro-library
pnpm install
```

### Run (Containerized - Recommended)

```bash
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up
```

Access: `http://localhost:5173` (frontend) and `http://localhost:3000` (API)

### Run (Local)

```bash
# Terminal 1: Backend
cd backend && pnpm dev

# Terminal 2: Frontend
cd frontend && pnpm dev
```

See [development docs](https://github.com/nguyenston/mokuro-library/blob/master/docs/architecture/development.md) for more options.

---

## 🌐 Production Deployment

### PM2 (Linux/Mac)

```bash
npm install -g pm2
pnpm build
pm2 start npm --name "mokuro-library" -- start
pm2 save
pm2 startup
```

### systemd (Linux)

`/etc/systemd/system/mokuro-library.service`:
```ini
[Unit]
Description=Mokuro Library Server
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/mokuro-library
ExecStart=/usr/bin/pnpm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable mokuro-library
sudo systemctl start mokuro-library
```

### Reverse Proxy

#### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    client_max_body_size 500M;
}
```

#### Caddy
```caddy
your-domain.com {
    reverse_proxy localhost:3001
    request_body { max_size 500MB }
}
```

---

## 🔧 Troubleshooting

### Docker Issues

**WSL 2 incomplete (Windows):**
```powershell
wsl --install  # Run as Administrator
```

**Virtualization disabled:**
- Enter BIOS/UEFI (F2/F12/Del during boot)
- Enable Intel VT-x or AMD SVM
- Verify in Task Manager → Performance → CPU → Virtualization: Enabled

**Port conflict:**
Edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3001"  # Change first number
```

### Database Issues

**Database locked:**
```bash
docker compose down
docker compose up -d
```

**Reset database:**
```bash
docker compose down
rm -rf ./data
docker compose up -d
```

### Upload Issues

**Permission denied (Linux/Mac):**
```bash
sudo chown -R $USER:$USER /path/to/mokuro-library
chmod -R 755 /path/to/mokuro-library
```

**Docker permissions:**
```bash
docker compose down
docker compose up -d --user $(id -u):$(id -g)
```

### Port Conflicts

**Find process using port:**
```bash
# Linux/Mac
lsof -ti:3001 | xargs kill -9

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

---

## 📋 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4+ GB |
| Storage | 10 GB | 50+ GB |
| OS | Win 10, macOS 10.15, Linux | Linux (production) |

**Network:** Port 3001 (configurable), optional internet for metadata scraping

---

## 🚀 First-Time Setup

1. Access `http://localhost:3001`
2. Create account (first user = admin)
3. Upload Mokuro-processed folders
4. Start reading

---

## 🆘 Getting Help

- Search [GitHub Issues](https://github.com/nguyenston/mokuro-library/issues)
- Create new issue with error logs, OS/Docker version, and reproduction steps

---

## 📦 Next Steps
- [Managing Your Library](/managing-your-library)
- [Using the Reader](/using-the-reader)
- [Customize Appearance](/appearance-settings)
