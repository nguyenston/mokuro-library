# Authentication

Multi-user support with separate reading progress, bookmarks, and preferences per account.

## Account Management

**First time setup:** Click "Create an account" on the login screen. The first registered user automatically becomes admin.

**Login:** Enter your credentials. Sessions persist until you explicitly log out.

**Logout:** Menu → Logout

## Multi-User Features

### Per-User Data
- Reading progress and page positions
- Bookmarks and read status
- Personal settings and preferences

### Shared Resources
- Manga library and uploaded content
- Metadata (titles, covers, descriptions)
- OCR text corrections

## Settings

Access via Menu → Settings

### Reader Preferences
- Layout mode (single/double page, vertical scroll)
- Reading direction and page offset
- Zoom retention and navigation width

See [Reader Settings](/reader-settings) for details.

### Appearance
- Theme selection and night mode
- Color inversion and red shift
- Scheduled night mode activation

See [Appearance Settings](/appearance-settings) for details.

## Security

### Passwords
Use strong passwords (8+ characters, mixed case, numbers, symbols). Don't reuse passwords.

### Server Deployment
For production deployments:
- Use HTTPS with SSL/TLS (Let's Encrypt)
- Configure reverse proxy (Nginx/Caddy)
- Enable firewall rules
- Keep application updated
- Regular database backups

## Data & Privacy

All user data stored in SQLite database:
```
backend/mokuro-library.db
```

Stored per user:
- Username (encrypted)
- Password (bcrypt hashed)
- Reading progress
- Preferences (JSON)
- Session tokens

**Backup regularly:**
```bash
cp backend/mokuro-library.db backend/mokuro-library.db.backup
```

## Multi-Device

Same account works across desktop, tablet, and phone. Progress syncs automatically.

## Troubleshooting

**Can't login:** Verify username/password (case-sensitive), clear browser cache, or contact admin.

**Session expired:** Check server hasn't restarted. SESSION_SECRET should be set in server config.

**Registration fails:** Ensure password is 6+ characters and both password fields match.


## Next Steps
- [Upload your manga](/managing-your-library)
- [Start reading](/using-the-reader)
- [Customize appearance](/appearance-settings)
