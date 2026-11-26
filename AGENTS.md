# Workspace Rules (aiBA)

## Silent Browser Testing (Mandatory Default)

Unless the user explicitly asks to test or debug audio/BGM/SFX/voice:

1. **Always mute before triggering any gameplay or user gesture** that unlocks WebAudio/media playback.
2. **Playwright / headless browser scripts**: Always pass `--mute-audio` when launching Chromium and preload `scripts/silence-browser.js` via `context.addInitScript(...)` (or inject `scripts/silence-browser.js` before calling `ensureAudio` / `beginLastShot` / starting any mode).
3. **Interactive / `browser` subagent verification**: Explicitly instruct the `browser` subagent to click the in-page mute/sound button (top-right sound icon) **immediately after page load and before clicking into any game mode or triggering audio**, and never unmute unless testing audio.
