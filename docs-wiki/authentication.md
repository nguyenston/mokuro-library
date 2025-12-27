# Authentication & User Management

Mokuro Library supports multiple user accounts, allowing families or shared servers to maintain separate reading progress, bookmarks, and preferences.

## Creating Your First Account

### Registration

When you first access Mokuro Library, you'll see the login screen:

1. Click "**Create an account**" below the login form
2. Enter a **username** (minimum 3 characters)
3. Enter a **password** (minimum 6 characters)
4. Confirm your password
5. Click "**Register**"

![Registration Form](/register-placeholder.svg)
*The registration panel with animated background*

::: tip Automatic Login
After successful registration, you'll be automatically logged in - no need to manually enter credentials again!
:::

::: info First User Privileges
The first user to register becomes the administrator with full access to all features and settings.
:::

## Logging In

### Standard Login

1. Navigate to your Mokuro Library URL
2. If not logged in, you'll see the login screen
3. Enter your username and password
4. Click "**Login**"

![Login Screen](/login-placeholder.svg)
*Clean, modern login interface*

### Session Management

- Sessions persist across browser restarts
- Closing the browser tab doesn't log you out
- Session cookies are secure and HTTP-only

::: tip Stay Logged In
Your session remains active until you explicitly log out or clear browser data.
:::

## Logging Out

To log out of your account:

1. Click the **menu button** (top right corner)
2. Scroll to the bottom of the menu
3. Click "**Logout**"

![Logout Button](/logout-placeholder.svg)
*Logout option in the app menu*

::: warning Data Safety
Logging out doesn't delete any data. Your reading progress and settings are safely stored on the server.
:::

## Multi-User Features

### Individual User Data

Each user account maintains separate:

- **Reading Progress** - Track which volumes you've read and where you left off
- **Bookmarks** - Mark favorite series for quick access
- **Read Status** - Volumes marked as unread, reading, or completed
- **Settings** - Personal preferences for reader layout, themes, and behavior

### Shared Library

While user data is separate, the manga library itself is shared:

- All users see the same manga collection
- Uploaded content is available to everyone
- Metadata edits (titles, covers, descriptions) affect all users
- OCR text corrections are saved globally

::: info Use Case Example
**Family Server:** Dad reads "One Piece" while tracking his progress. Mom reads "Fruits Basket" with her own bookmarks. The kids access their favorite series - everyone's progress is independent!
:::

## User Settings

Each user can customize their experience in the **Settings** page.

### Accessing Settings

1. Click the **menu button** (top right)
2. Select "**Settings**"

### Available Settings

![Settings Page](/settings-placeholder.svg)
*User settings interface*

#### Account Information

- View your username
- See account creation date
- Check last login time

::: tip Coming Soon
Password change and account management features are planned for future releases.
:::

#### Reader Preferences

Customize how you read manga:

- **Layout Mode** - Single page, double page, or vertical scroll
- **Reading Direction** - Right-to-left (manga) or left-to-right
- **Page Offset** - For double-page spreads
- **Zoom Retention** - Remember zoom level between pages
- **Navigation Width** - Size of clickable page navigation areas

See [Reader Settings](/reader-settings) for detailed configuration.

#### Appearance

Personalize the visual experience:

- **Theme Selection** - Choose from multiple color themes
- **Night Mode** - Enable automatic dark mode
- **Color Inversion** - For reading in low light
- **Schedule** - Auto-enable night mode at specific times

See [Appearance Settings](/appearance-settings) for full customization options.

## Security Best Practices

### Strong Passwords

::: danger Password Security
- Use passwords with at least 8-12 characters
- Include uppercase, lowercase, numbers, and symbols
- Don't reuse passwords from other services
- Don't share your password with others
:::

### Session Security

- Always log out on shared computers
- Don't save passwords in public browsers
- Clear browser data after using public devices

### Server Security

If you're hosting for others:

- Use HTTPS with SSL/TLS certificates (Let's Encrypt is free!)
- Set up a reverse proxy (Nginx, Caddy)
- Enable firewall rules
- Keep the application updated
- Regular backups of the database

## Account Management

### Changing Your Password

::: tip Coming Soon
Password change functionality is planned for a future release. For now, contact your server administrator if you need to reset your password.
:::

### Deleting Your Account

::: tip Coming Soon
Self-service account deletion is planned. Currently, contact your administrator to remove an account.
:::

### Administrator Actions

If you're the server administrator, you can:

- Access the database directly to manage users
- Reset passwords via database commands
- Remove user accounts if needed

::: warning Direct Database Access
Modifying the database directly requires technical knowledge. Always backup before making changes!
:::

## Troubleshooting

### Can't Log In

**"Invalid username or password" error:**

1. Verify your username (case-sensitive)
2. Check your password carefully
3. Try clearing browser cache
4. Contact administrator if issue persists

**Login button doesn't work:**

1. Refresh the page
2. Try a different browser
3. Clear browser cache and cookies
4. Check browser console for JavaScript errors

### Session Expired

If you're randomly logged out:

1. Check if SESSION_SECRET is set in server config
2. Verify server hasn't restarted
3. Check for clock synchronization issues
4. Try logging in again

### Registration Not Working

**"Create an account" button unresponsive:**

1. Ensure JavaScript is enabled
2. Check password meets requirements (6+ characters)
3. Verify both password fields match
4. Check browser console for errors

**Registration succeeds but login fails:**

1. This shouldn't happen with auto-login
2. Try manual login with your credentials
3. Contact administrator if issue persists

## Privacy & Data

### What Data is Stored?

For each user account:

- Username (encrypted)
- Password (hashed with bcrypt)
- Reading progress (volume ID, page number, completion status)
- User preferences (JSON blob)
- Session tokens (temporary)

### Data Location

All user data is stored in the SQLite database at:
```
backend/mokuro-library.db
```

### Backup Your Data

Administrators should regularly backup:

```bash
# Simple backup
cp backend/mokuro-library.db backend/mokuro-library.db.backup

# Backup with timestamp
cp backend/mokuro-library.db "backend/backups/mokuro-$(date +%Y%m%d).db"
```

## Multi-Device Access

### Same Account, Multiple Devices

You can log in to the same account from multiple devices:

- **Desktop** - Full-featured web interface
- **Tablet** - Touch-optimized reading experience
- **Phone** - Responsive mobile layout

Reading progress syncs automatically across all devices!

### Multiple Users, One Server

Perfect for families:

- Each person gets their own account
- Everyone accesses the same server URL
- Individual progress tracking
- Separate bookmarks and preferences

## Next Steps

Now that you're logged in:

- [Upload your manga](/managing-your-library)
- [Start reading](/using-the-reader)
- [Customize your experience](/appearance-settings)
- [Configure reader preferences](/reader-settings)

## Related Pages

- [Installation](/installation) - Setting up the server
- [Managing Your Library](/managing-your-library) - Upload and organize manga
- [Appearance Settings](/appearance-settings) - Customize the look
- [Reader Settings](/reader-settings) - Configure reading preferences
