# QXTradeLens Bookmark Updater Chrome Extension

This unpacked Chrome extension updates and renames the existing `QX_Calc` bookmark to `QXTradeLens` on the bookmarks bar using Chrome's live `chrome.bookmarks` API, so Chrome can be running.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   `/Users/vishal/Projects/QXBookmarklet/chrome-extension/qx-calc-updater`

## Use

- Click the extension toolbar icon to update `QXTradeLens` immediately.
- The extension also attempts an update when it is installed/reloaded and when Chrome starts.
- If you still have `QX_Calc`, the extension will rename it to `QXTradeLens` the next time it runs.

## Updating the payload

Run the normal build command from the project root:

```bash
./build-bookmarklet.sh calculator.js
```

The build script copies `calculator.min.js` into this extension as `bookmarklet.js`. After building, click the extension icon to push the latest bookmarklet into Chrome's live bookmarks.
