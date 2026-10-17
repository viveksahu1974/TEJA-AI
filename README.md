# TEJA AI 🐺 — Multi-Model Assistant (v2.1)

A local AI chat web app with your custom wolf logo, animated glow effects, voice input/output, optional Google search, and support for **ChatGPT / Gemini / Claude / DeepSeek**.

## What changed in v2.1
- **TEJA AI Smart** in the model dropdown and **TEJA AI Mode** in the workspace sidebar
- Provider switcher: **TEJA AI Smart, ChatGPT, Gemini, Claude, DeepSeek**
- TEJA AI Smart routes each request to **an available connected AI provider**. This is an orchestration feature, NOT an independently trained foundation model. The actual provider is shown below the answer.
- If multiple provider keys are set: Study defaults to Gemini, Coding to DeepSeek, Writing to Claude, and other workspaces to OpenAI when available. Falls back to another connected provider if the preferred one is not configured.
- **Voice input** (browser speech recognition) + **auto-speak replies**
- Optional **Google Search** support via Google Custom Search API
- Animated wolf logo with glow / lighting effect
- Improved status bar and provider-specific metadata

## Quick start on Windows
1. Extract the ZIP.
2. Open the extracted `teja-ai` folder.
3. Double-click `START_TEJA_AI.bat`.
4. Open `http://127.0.0.1:8000/`. Press `Ctrl+F5` to refresh old cached pages after upgrading.
5. Keep the server window open while using TEJA AI.

## Real AI setup (API keys)
Without API keys, TEJA shows **Demo Mode** only.

Open **PowerShell inside the `teja-ai` folder** and set whichever providers you want:

### ChatGPT / OpenAI
```powershell
$env:OPENAI_API_KEY="YOUR_OPENAI_KEY"
$env:OPENAI_MODEL="gpt-4.1-mini"
py server.py
```

### Gemini
```powershell
$env:GEMINI_API_KEY="YOUR_GEMINI_KEY"
$env:GEMINI_MODEL="gemini-2.5-flash"
py server.py
```

### Claude
```powershell
$env:ANTHROPIC_API_KEY="YOUR_ANTHROPIC_KEY"
$env:ANTHROPIC_MODEL="claude-3-5-sonnet-latest"
py server.py
```

### DeepSeek
```powershell
$env:DEEPSEEK_API_KEY="YOUR_DEEPSEEK_KEY"
$env:DEEPSEEK_MODEL="deepseek-chat"
py server.py
```

### Multiple providers at once
You can set **all** of them before running the server:
```powershell
$env:OPENAI_API_KEY="YOUR_OPENAI_KEY"
$env:GEMINI_API_KEY="YOUR_GEMINI_KEY"
$env:ANTHROPIC_API_KEY="YOUR_ANTHROPIC_KEY"
$env:DEEPSEEK_API_KEY="YOUR_DEEPSEEK_KEY"
py server.py
```
Then choose the provider from the TEJA AI dropdown.

## Google Search setup (optional)
TEJA AI can use **Google Custom Search** if you configure:
```powershell
$env:GOOGLE_CSE_API_KEY="YOUR_GOOGLE_CUSTOM_SEARCH_KEY"
$env:GOOGLE_CSE_CX="YOUR_SEARCH_ENGINE_ID"
py server.py
```
Then switch on **Google Search** in the UI.

## Voice features
- **🎙 Mic button** = speech-to-text input (works best in Chrome)
- **🔊 button** = auto-read assistant replies aloud
- Hindi and English both generally work, depending on browser support

## Notes
- API billing depends on the provider accounts you use.
- TEJA AI stores chat history in browser localStorage.
- Do not publish secret API keys to GitHub.
- DeepSeek image input is not implemented in this local starter.
- Google search uses Custom Search, not full unrestricted web browsing.

## File map
- `server.py` — Python local server + provider integrations
- `public/index.html` — UI markup
- `public/style.css` — styling + logo animation
- `public/app.js` — frontend logic, voice, provider selection
- `START_TEJA_AI.bat` — Windows launcher

Enjoy building TEJA AI 🚀

## Upgrading from v2.0
Close the old TEJA server (`Ctrl+C` in its terminal). Extract this ZIP into a **new folder**, open `teja-ai`, run `START_TEJA_AI.bat`, and refresh the browser. If you set API keys in PowerShell, run `py server.py` in the **same PowerShell window** where you configured the keys. Do **not** put secret keys in public frontend files or GitHub.
