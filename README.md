# urlPanda 🐼

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

**urlPanda** is a fast, clean, and lightweight Chrome extension to save, organize, and track your important web links. It keeps all your bookmarks organized locally with folders, tags, reading lists, instant search, duplicate alerts, and JSON backup/restore—with zero backend, zero account requirements, and 100% privacy.

---

## ✨ Features

### 📁 1. Folders & Collections
* **Organize by topic:** Group your links into custom folders such as `Development`, `Learning`, `Projects`, `Personal`, and `General`.
* **Full Folder Management:** Create new folders, rename existing folders, and delete folders with automatic reassignment of links to `General` to avoid data loss.
* **Easy Organization:** Move links between folders at any time from the link editor or directly when saving.

### 🔍 2. Instant Search & Filters
* **Real-time Search:** Instantly search across link titles, URLs, personal notes, and tags as you type.
* **Multi-criteria Filtering:** Filter links simultaneously by folder, tag, and reading status.
* **Quick Tag Bar:** Click any tag chip (`#frontend`, `#article`) to quickly filter matching links.
* **One-Click Reset:** Clear all active filters with a single click.

### ✏️ 3. In-Place Link Editing
* Edit a link’s **title**, **URL**, **folder**, **reading status**, **tags**, and **notes** at any time without deleting and recreating it.
* Built-in URL validation to prevent broken or malformed entries.

### 🏷️ 4. Custom Tags & Notes
* **Tags:** Add multiple comma-separated tags to organize links horizontally across folders.
* **Personal Notes:** Save context, key takeaways, or reminders right with each bookmark.

### ⚠️ 5. Smart Duplicate Detection
* Detects when a URL is already in your collection (handling trailing slashes and casing automatically).
* Provides an intuitive prompt with options to:
  * **Open Existing:** Jump right to the existing link.
  * **Save Anyway:** Add as a duplicate if you need a separate entry.
  * **Cancel:** Abort without altering your library.

### 📖 6. Reading List Tracker
* Track your reading pipeline with three distinct states:
  * ⚪ **Unread**
  * 🟡 **In Progress**
  * 🟢 **Completed**
* **One-Click Toggle:** Click the status badge directly on any card to cycle through statuses.
* Filter your view by reading status to find what to read next.

### 💾 7. Backup & Restore (JSON)
* **Export:** Download a complete JSON backup containing all your links, folders, and tags with a timestamped filename.
* **Import:** Restore from a backup file with error validation.
* **Duplicate Strategies on Import:**
  * *Skip duplicates* (Safe, recommended)
  * *Overwrite / update existing*
  * *Keep both* (import all copies)
* **Zero Data Loss:** Preserves your existing saved bookmarks during imports and extension updates.

### ⚡ 8. Better Link Management & UI
* **Sorting Options:** Sort by **Newest First**, **Oldest First**, **Title (A → Z)**, **Title (Z → A)**, or **Website / Domain (A → Z)**.
* **Delete Confirmation:** Accidental clicks won't lose your data—confirmation prompts protect your links.
* **Copy URL:** One-click clipboard copy with instant feedback toast.
* **Favicon Support:** Automatically fetches website favicons with clean fallback icons.
* **Clean & Responsive UI:** Modern card design with dark mode and light mode support (`prefers-color-scheme`).
* **100% Local & Private:** All data is stored in `chrome.storage.local` on your device. No analytics, no server requests, no tracking.

---

## 🚀 How to Install

Since urlPanda is built with standard Manifest V3 and runs unpacked:

1. **Download or Clone:**
   ```bash
   git clone https://github.com/m-sohel/urlPanda.git
   ```
2. **Open Chrome Extensions:**
   * In Google Chrome (or Edge, Brave, Chromium), navigate to `chrome://extensions`.
3. **Enable Developer Mode:**
   * Toggle the **Developer mode** switch in the top-right corner.
4. **Load Unpacked:**
   * Click **"Load unpacked"** in the top-left toolbar.
   * Select the `urlPanda` directory (the folder containing `manifest.json`).
5. **Pin & Use:**
   * Click the puzzle icon in Chrome’s toolbar and pin **urlPanda 🐼** for instant access!

---

## 📁 Project Structure

```
urlPanda/
├── images/
│   ├── icon16.png        # Extension icon (16x16)
│   ├── icon32.png        # Extension icon (32x32 for high-DPI displays)
│   ├── icon48.png        # Extension icon (48x48)
│   ├── icon128.png       # Extension icon (128x128)
│   └── panda.png         # Source panda artwork (512x512)
├── test/
│   └── extension-logic.test.js # Automated unit test suite
├── manifest.json         # Chrome Extension Manifest V3 configuration
├── popup.html            # Main popup interface & modal dialogs
├── popup.css             # Responsive theme styling (Light & Dark mode)
├── popup.js              # Business logic, storage sync, and UI handlers
├── LICENSE               # MIT License
└── README.md             # Documentation
```

---

## 🧪 Testing

urlPanda includes an automated unit test suite verifying URL normalization, backward compatibility migration, duplicate detection, folder management, search/sort filters, and JSON backup/restore.

To run the unit tests:

```bash
node test/extension-logic.test.js
```

---

## 🔒 Privacy

urlPanda requires only two Chrome permissions:
* `storage`: To save your bookmarks and folders locally in your browser (`chrome.storage.local`).
* `tabs`: To read the URL and title of the active tab when you click "Save Tab".

No external servers, accounts, or analytics are used. Your data belongs solely to you.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Made with 💛 by Mohammad Sohel**
