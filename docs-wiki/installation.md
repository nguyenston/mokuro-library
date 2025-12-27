# Installation

## 🐳 Docker (Recommended)

```bash
# Clone and navigate
git clone https://github.com/nguyenston/mokuro-library.git
cd mokuro-library

# Build and run
docker compose build
docker compose up -d
```

**Access at:** `http://localhost:3001`

Your data will be stored in `./data` and `./data/uploads`

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

## 🚀 First-Time Setup

1. Access `http://localhost:3001`
2. Create an account (first user becomes admin)
3. Upload your Mokuro-processed manga folders
4. Start reading

---

## 📦 Next Steps
- [Managing Your Library](/managing-your-library) - Upload and organize manga
- [Using the Reader](/using-the-reader) - Start reading
- [Appearance Settings](/appearance-settings) - Customize your experience
