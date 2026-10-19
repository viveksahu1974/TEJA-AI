# TEJA AI interactive website preview

This is a **sample, front-end-only demo**. It does not run a real AI model and it does not make OpenAI/Gemini/Claude/DeepSeek calls. The `demo-shim.js` intercepts only the demo status, chat and TTS endpoints to show clearly labelled canned responses. No API keys are included. Demo history uses browser localStorage (not the SQLite backend). Browser speech depends on available device voices.

The GitHub Pages workflow publishes the current `public` assets and replaces the start page with `demo/index.html` and loads `demo/demo-shim.js`.

To enable the website, open repository **Settings → Pages → Build and deployment → Source: GitHub Actions**, then rerun **Deploy TEJA Preview to Pages** from the Actions tab. GitHub Pages cannot run `server.py` or local Ollama; a separate secure backend host is required for genuine AI answers.
