# Chrome Web Store listing: copy and answers

Paste these into the Chrome Web Store Developer Dashboard.

## Store listing tab

**Name:** Tab Shelf

**Summary (max 132 characters):**
Save windows of tabs to a clear, searchable shelf. Open one tab at a time; the link stays saved until you remove it.

**Category:** Productivity → Tools (or Workflow & Planning)

**Language:** English

**Description:**

Too many windows with 20+ tabs slowing your computer down? Tab Shelf moves them onto a clean, searchable list so you can close them without losing anything.

HOW IT WORKS
• Click the Tab Shelf button and choose "Save window & close its tabs". The whole window is saved to your shelf, and the tabs close.
• Your shelf is a tidy page listing every saved window, newest first, with titles, sites and icons.
• Click any saved tab to open it. It stays on the shelf, so you can close it when you're done and come back to it later.
• Search everything you've ever saved, rename windows, and open a whole window again with one click when you need it.

BUILT NOT TO LOSE YOUR TABS
• Tabs are only closed after the save is confirmed.
• Opening a saved tab never removes it from the shelf.
• Deleting asks for confirmation, and every delete can be undone.
• Export a backup file at any time and import it again later. Import also understands Tabmate-style exports.

PRIVATE
• No account, no sign-in, no servers, no tracking.
• Everything is stored locally in your browser.

Keyboard: Alt+Shift+S opens the save menu. On the shelf, press / to search.

**Graphics (all in this folder):**
- Store icon: `extension/icons/128.png`
- Screenshots (1280×800): `screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png`
- Small promo tile (440×280): `promo-small-440x280.png`

## Privacy practices tab

**Single purpose:**
Tab Shelf saves the user's open browser tabs to a local list and lets them reopen those tabs one at a time.

**Permission justifications:**
- **tabs:** Needed to read the URL and title of the tabs the user chooses to save, to open saved tabs again, and to close tabs after they have been saved.
- **storage:** Stores the user's saved tabs locally in chrome.storage.local.
- **unlimitedStorage:** Users may save thousands of tabs; this prevents the local storage quota from silently blocking a save.
- **favicon:** Displays each saved site's icon on the shelf page using Chrome's built-in favicon cache.

**Remote code:** No, I am not using remote code. All code is included in the package.

**Data usage:** Tick **Web history** (the URLs and titles of tabs the user saves). Then confirm all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:**
`https://github.com/YOUR-GITHUB-USERNAME/tab-shelf/blob/main/PRIVACY.md`

## Package

Upload `tab-shelf-store-upload.zip`, which has `manifest.json` at the top level of the zip. To rebuild it after changes, zip the *contents* of the `extension` folder, not the folder itself, and bump `"version"` in `manifest.json` for each new upload.
