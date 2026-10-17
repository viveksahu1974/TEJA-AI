# TEJA AI v2.2 — Free Local Mode + Multi-Model

This project is a local Python web app using **Ollama** for real AI answers from a local model, with optional OpenAI, Gemini, Claude, DeepSeek and Google Custom Search integrations. No paid API key is needed for the local option. **Ollama and model downloads are separate and NOT bundled in this ZIP.**

## Your laptop: 16 GB RAM, Intel i5-1155G7, ~193 GB free storage

Start with **qwen2.5:3b**, a ~1.9 GB model download; it typically runs on CPU within this hardware class. Larger 7B models may respond significantly more slowly on this CPU.

## Setup — Windows 11

1. Install Ollama from **https://ollama.com/download/windows**.
2. Open a **new PowerShell** window (not necessarily the project folder), then download the model:
   ```powershell
   ollama pull qwen2.5:3b
   ```
3. Test local AI directly:
   ```powershell
   ollama run qwen2.5:3b
   ```
   Ask **Hello TEJA**, then type `/bye` to exit the chat. Ollama should continue running in the background (its tray icon may appear). If Ollama is not running, use `ollama serve` in a separate terminal. If it says address already in use, the Ollama service is already running; do not start a second instance.
4. Stop any older TEJA server first (Ctrl+C in the server terminal).
5. Extract this ZIP into a new folder, go inside `teja-ai`, double click **START_TEJA_AI.bat**.
6. Open **http://127.0.0.1:8000/**. In the dropdown select **TEJA Local (Ollama)**, or **TEJA AI Smart** (now prefers the local model when available). Turn **Google Search OFF** for fully local text chat.
7. Send **Hello TEJA** or **Explain C programming in simple English**.

### Status check
Open **http://127.0.0.1:8000/api/status**. Under `providers.ollama`, `ready` should be `true`, and `providers.teja.via` should be `ollama` for auto-mode. `ready` only means the service has the selected model installed; the first answer may take some time to load on CPU.

### If no replies appear
- Make sure Ollama is installed and running, and `ollama list` includes `qwen2.5:3b`.
- Test Ollama independently via `ollama run qwen2.5:3b`.
- Stop the old TEJA server on port 8000 or use `$env:PORT='8001'; py server.py` from the project folder. Then open the **same port** in your browser.
- Refresh the TEJA page with Ctrl+F5. Choose TEJA Local manually if TEJA Smart routes to OpenAI and shows no-credits errors.
- Keep your TEJA server window open.

## Other features
- TEJA AI Smart prefers local Ollama over cloud models, then falls back to whichever configured provider is available.
- Voice input uses browser speech recognition, which may require an internet connection. Voice playback uses browser speech synthesis. Offline voice operation is **not** guaranteed.
- Google Search requires separate Google CSE credentials and an internet connection. It is optional and not needed for basic local AI answers.
- The Qwen2.5:3b model is **text only**: local image recognition is not supported by this model.
- With OpenAI/Gemini/Claude/DeepSeek manually selected, usage and billing rules of that provider still apply.
- The project uses your original wolf logo and glow/lighting animations.
- This is a **local** project. Keep port 8000 bound to 127.0.0.1; do not expose it publicly without securing it.
- Local model does not have built-in live internet knowledge. Chat content sent to local Ollama normally stays on your computer, but browser voice recognition services may process audio online.

## Privacy and licensing
- Browser chat history is stored locally in `localStorage`. Do not input passwords or secrets into chats.
- Qwen2.5 3B uses a model-specific license; check its terms before commercial distribution.
- Never paste secret API keys into the TEJA frontend or publish them to GitHub.

## Files
- `server.py`: provider routing and Ollama API bridge
- `public/index.html`, `style.css`, `app.js`: web interface
- `START_TEJA_AI.bat`: Windows launcher
- `public/teja-icon.png`: your wolf logo

## Official sources
- Ollama Windows installer: https://ollama.com/download/windows
- Qwen 2.5 model page: https://ollama.com/library/qwen2.5
- Ollama API: https://docs.ollama.com/api/chat
