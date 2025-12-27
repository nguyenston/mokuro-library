---
layout: home

hero:
  name: Mokuro Library
  text: Self-Hosted Manga Server
  tagline: A modern, Plex-like server for your Mokuro-processed manga library with multi-user support, OCR editing, and seamless reading experience
  image:
    src: /hero-placeholder.svg
    alt: Mokuro Library
  actions:
    - theme: brand
      text: Get Started
      link: /installation
    - theme: alt
      text: View on GitHub
      link: https://github.com/nguyenston/mokuro-library

features:
  - icon: 📚
    title: Centralized Library Management
    details: Manage your entire manga collection in one place. Organize series, upload new content, and track your reading progress across all devices.

  - icon: 👥
    title: Multi-User Support
    details: Create multiple user accounts with separate reading progress, bookmarks, and personalized settings. Perfect for families or shared servers.

  - icon: 📖
    title: Advanced OCR Reader
    details: Built on Mokuro's OCR technology. Select and copy Japanese text directly from manga pages for instant dictionary lookups and language learning.

  - icon: ✏️
    title: Real-time OCR Editing
    details: Edit and correct OCR text boxes directly in the reader. Resize, move, and modify text to improve accuracy. Changes save back to your files.

  - icon: 🎨
    title: Customizable Reading Experience
    details: Choose from single page, double page spreads, or vertical scrolling modes. Adjust zoom, page direction, and layout to match your preferences.

  - icon: 🌙
    title: Night Mode & Color Inversion
    details: Built-in night mode with adjustable intensity and red shift. Schedule automatic activation or invert colors for comfortable late-night reading.

  - icon: 📊
    title: Progress Tracking
    details: Automatic reading progress sync across devices. Mark volumes as read, track completion status, and pick up exactly where you left off.

  - icon: 🔍
    title: Smart Search & Filtering
    details: Powerful search with filters for reading status, bookmarks, organization, and missing metadata. Sort by title, last updated, or recent activity.

  - icon: 🏷️
    title: Metadata Management
    details: Add custom covers, descriptions, and titles to your series. Scrape metadata from online sources or manually organize your collection.

  - icon: 🎯
    title: Selection Mode
    details: Bulk operations made easy. Select multiple volumes to update metadata, change status, or perform batch actions across your library.

  - icon: 💾
    title: Export & Backup
    details: Export your library as ZIP (with or without images) or PDF format. Perfect for backups or sharing with other devices.

  - icon: 🚀
    title: Modern Tech Stack
    details: Built with SvelteKit and TypeScript. Fast, responsive UI with smooth animations and real-time updates. Self-hosted on your own server.
---

## What is Mokuro Library?

Mokuro Library transforms your [Mokuro](https://github.com/kha-white/mokuro)-processed manga into a fully-featured, self-hosted library server. Unlike the original browser-based Mokuro reader, this is a **server-side application** that runs persistently on your home server, NAS, or cloud instance.

### Why Use Mokuro Library?

**Perfect for serious manga readers who want:**

- 🏠 **Self-Hosted Control** - Your data stays on your server, not in browser storage
- 📱 **Multi-Device Sync** - Access your library from any device with seamless progress sync
- 👨‍👩‍👧‍👦 **Family Sharing** - Multiple user accounts with individual progress and settings
- 💽 **No Storage Limits** - Manage large libraries without browser quota restrictions
- 📝 **Persistent Edits** - OCR corrections save directly to your `.mokuro` files
- 🎯 **Professional Features** - Advanced organization, metadata management, and bulk operations

### How It Works

1. **Process Your Manga** - Use [Mokuro](https://github.com/kha-white/mokuro) to extract OCR data from your manga
2. **Upload to Library** - Import processed folders into Mokuro Library
3. **Read & Enjoy** - Access from any browser with your personalized reading experience
4. **Edit & Improve** - Correct OCR text and save changes permanently

## Quick Start

### 🐳 Docker (Recommended)

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

### 💻 Windows Portable

1. Download `MokuroLibrary-Windows.zip` from [Releases](https://github.com/nguyenston/mokuro-library/releases)
2. Extract and run `mokuro-library.exe`
3. Access at `http://localhost:3001`

---

For more details, see the [Installation Guide](/installation).

## Screenshots

::: tip Coming Soon
Screenshots of the library interface, reader, and editing features will be added here.
:::

<!-- Placeholder for screenshots -->
![Library View](/library-placeholder.svg)
*Browse your manga collection with grid or list view*

![Reader Interface](/reader-placeholder.svg)
*Enjoy a clean reading experience with OCR text selection*

![OCR Editor](/editor-placeholder.svg)
*Edit text boxes with precision and save changes*

## Community & Support

- 📖 **Documentation** - You're reading it! Check the sidebar for detailed guides
- 💬 **Discord** - Join our community for help and discussions
- 🐛 **Issues** - Report bugs or request features on [GitHub](https://github.com/nguyenston/mokuro-library/issues)
- ⭐ **Star Us** - Show your support on [GitHub](https://github.com/nguyenston/mokuro-library)

## License

Released under the MIT License. See [LICENSE](https://github.com/nguyenston/mokuro-library/blob/master/LICENSE) for details.

---

::: info Note
This project is built on top of the excellent [Mokuro](https://github.com/kha-white/mokuro) OCR tool by kha-white. Make sure to check out the original project for manga processing!
:::
