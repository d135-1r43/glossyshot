# Glossyshot

Chrome extension (Manifest V3): click the toolbar icon (or press `Alt+Shift+S`) and the current tab is captured inside a browser-window mockup with traffic lights, a location bar showing the URL, a gradient background and soft shadows. You can then download it as a PNG or copy it to the clipboard.

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and pick this folder
4. Pin Glossyshot to the toolbar

The simulated viewport uses Chrome's own device emulation (the same as DevTools' device mode), so the extension needs the `debugger` permission. During each capture, Chrome briefly shows a "started debugging this browser" bar. Your real window is never resized.

## Settings (saved between uses)

- **Viewport:** 1024 / 1280 / 1440 / 1920 (all 16:10). Simulates a browser window of that size, so the page lays out as it would on a smaller screen and the text comes out large. **Window** captures the tab exactly as it is now.
- **Sharpness:** 1× / 2× / 3× pixel density. For example, 1280 at 2× gives a 2560 px wide image that stays crisp on projectors.
- **Frame:** light or dark
- **Padding:** S / M / L
- **Background:** six gradients, plain white, or transparent
- **Instant save:** downloads the PNG as soon as the popup opens, so it takes one click

In the popup: `Enter` downloads, `⌘/Ctrl+C` copies, and ↻ takes the capture again.

## License

MIT, see [LICENSE](LICENSE).
