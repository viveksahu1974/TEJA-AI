# TEJA AI v2.9 — Training Studio + Starter Training Pack 🐺

**Developed by VIVEK SAHU**

This repository includes a **voice + text Training Studio** and a starter behavior pack with 17 rules. It builds on the original TEJA AI local/Ollama assistant with multilingual speech and device-stored chat history.

## Launch on Windows

1. Install Python 3.11 or newer and [Ollama](https://ollama.com/download/windows).
2. In PowerShell run `ollama pull qwen2.5:3b` (model download required once).
3. Double-click `START_TEJA_AI.bat`; keep the server terminal open.
4. Open `http://127.0.0.1:8000/` and click **🧠 Training Studio — Voice + Text** under New conversation.
5. Starter rules are automatically installed on first server start. Review, edit, disable or delete them. **Speak a rule using 🎙 Dictate** or type it and click **💾 Save Training**.
6. Ask TEJA `hello`, `who created teja ai`, or any study/coding question to try the rules.

If port 8000 is already in use, close older TEJA servers or launch from PowerShell in this folder with `$env:PORT="8001"; py server.py`, then browse to port 8001.

## Training behavior

* Rules are saved under `%LOCALAPPDATA%\TEJA-AI\training.sqlite3` on Windows, outside the repository. Old personal greetings and matching corrections are preserved when bundled starter rules install.
* Six types: speaking instructions, preferred phrases, avoided phrases, replacements, exact corrected answers and custom greetings.
* Existing rules remain after updating the code. A deleted bundled rule does not reappear on every restart.
* This is **persistent prompt personalization**, not retraining or fine-tuning Ollama weights.
* The AI can still make mistakes. Do not ask it to store passwords or API keys. Training prompts for cloud providers may be sent with chat requests.
* For local generation, Ollama must be running. Hindi online TTS is separate and needs `edge-tts` and internet, with text sent to the speech provider.
* This localhost application has no user authentication: **do not expose the local server publicly.**

**Files added:** `default_training.json`, `public/training.js`, `public/training.css`. The existing voice/chat interface is preserved.

---

# TEJA AI v2.5 — Hindi & multilingual speaking fix

The v2.4 Windows/Edge browser speech engine may pronounce English but fail for Hindi and other Indian languages. v2.5 adds an **optional independent online multilingual speech engine** using the Python `edge-tts` package. Your chat model can still run locally on Ollama, but **text being read aloud is sent to an external online speech service** when this engine is selected. It is not an offline voice solution and its availability depends on the service and network.

## Quick install (Windows)

1. Close TEJA AI's previous server (`Ctrl+C`), including other servers using port 8000.
2. Extract this new ZIP. Open the extracted `teja-ai` folder.
3. **Double-click `INSTALL_MULTILINGUAL_VOICE.bat`** to install the optional speech package. Keep the internet connected. If installation fails, open PowerShell in this folder and run `py -m pip install --user --upgrade edge-tts`.
4. Start `START_TEJA_AI.bat` and open `http://127.0.0.1:8000/`. Press `Ctrl+F5` to reload.
5. In the toolbar select **Engine → Multilingual online**, **Language → हिन्दी – Hindi / Hinglish**, **Speaker → Female** (or Male), and **Speed → 1×**.
6. Click **▶ Test voice**. It should speak a short Hindi sample. Click **🔉 Listen** next to an AI reply to read it out loud. Enable the top-right 🔊 button for automatic speaking after every reply.

**Tip:** For clear pronunciation, ask TEJA “हिन्दी में देवनागरी लिपि में उत्तर दो.” Romanized Hinglish can sound unnatural even with a Hindi voice. If English was previously selected, v2.5 detects clearly non-Latin scripts in replies and automatically picks the matching online voice. Use explicit Hindi for Romanized Hinglish.

If your audio still fails, read the full text shown underneath the voice controls:
- **“Install online voices”**: run the `INSTALL_MULTILINGUAL_VOICE.bat` and restart TEJA.
- **“Online multilingual voice unavailable”**: check internet, try the install again, or switch to **Windows/browser voice** and install a supported Windows language voice.
- **“Browser blocked audio”**: click `▶ Test voice` directly, unmute the browser tab and check Windows audio output.

This method is best-effort and is **not guaranteed to work in every region or network**; the upstream online service can change. Installing `edge-tts` does not install offline voices. For fully offline Hindi speech, a separate local TTS model would need to be installed and configured.

Your **local chat history remains at** `%LOCALAPPDATA%\TEJA-AI\history.sqlite3`, outside the extracted project directory. Keep your user profile/backup safe.

---

# TEJA AI 🐺 v2.4 — Speech playback troubleshooting + history

**Update of the original TEJA AI v2.2 local Ollama assistant.** Includes Ollama, TEJA Smart Mode, optional OpenAI/Gemini/Claude/DeepSeek, optional Google Search, glowing wolf logo, and voice features. This version adds **persistent conversations** and more flexible speaking-language settings.

## New in v2.4 — voice playback fix

- **▶ Test voice** next to the voice controls — test playback without asking the AI another question.
- Better diagnostics: if the browser fails speech synthesis, TEJA reports the **actual error category** (for example, `network`, `synthesis-failed`, `voice-unavailable`, or `not-allowed`).
- When an **online voice** fails, TEJA tries other available voices of the **same language**, preferring installed/local voices, followed by browser automatic voice.
- Long replies are spoken in shorter chunks to reduce failures with some Windows browser TTS engines.
- Stop button cancels the current speech session and pending retries.
- **Important**: No app can force a missing or broken Windows/browser speech engine to work. If all voices fail, fix Windows speech/audio settings or try an alternate browser/voice. Automatic fallback might sound different, especially without a local voice in the selected language.

### If you see `Voice playback failed` on Microsoft Madhur Online (Natural)

1. Click **Voice → Automatic voice**, set **Language → Hindi**, then click **▶ Test voice**.
2. If it still fails, try a Hindi voice labelled **device** (if one exists). Otherwise try **English (India)** and an installed English voice to confirm audio is functioning.
3. Check Windows volume, output device, and browser tab sound. If both languages fail, test the system speaker in **Settings → System → Sound**.
4. To add a language, try **Windows Settings → Time & language → Language & region → Add a language → Hindi → Language options**. Speech/Text-to-speech resources depend on Windows edition, language, and voice availability.
5. Restart Edge and TEJA after installing a voice. If an online voice fails, network access to the voice service may be blocked even though local TEJA/Ollama answers work.

## What is fixed

- **History persists across browser restarts, browser changes, and local port changes** (for the same computer/user account), because conversations are now saved to an on-device SQLite database, not only browser localStorage.
- Chats are saved **as soon as you send a question**, and again when the answer arrives; this includes error or demo replies.
- Older history from the *same browser origin* is automatically imported the first time the new version opens there. History from another browser/profile/port **cannot be automatically read from that browser**. To migrate old chats saved only in a browser, first open this updated version using the old address/browser to import it.
- Click a chat under **CHAT HISTORY** to reopen it. Use **×** to delete one, **⬇ Backup** to export JSON, or **Clear all** to remove everything.
- **Microphone**: click 🎙, speak, and send the transcribed text.
- **Voice output**: click **🔊** in the top bar to automatically read replies; or click **🔉 Listen** next to any reply. Use **⏹ Stop** to stop playback.
- **Languages**: use the *Language* drop-down in the voice toolbar, and choose an installed voice in *Voice*. Includes Hindi, English, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Odia, Nepali, Arabic, French, Spanish, German, Portuguese, Japanese, Korean, Chinese, Russian. **These are language preferences, not guaranteed voice packs**. Actual input/output language support depends on the browser and voice packs installed on Windows. With Auto, the script of the reply is detected; Roman-letter Hinglish usually needs an explicit Hindi selection.
- **Speaking is not the same as understanding**: the Ollama/cloud model generates the answer as text and the browser reads it aloud. Language accuracy also depends on the model.

## Start on Windows 11

1. Shut down your previous TEJA AI server window (Ctrl+C). Old ports 8000/8001 must not be serving the older version.
2. Extract the new ZIP into a new folder. Open the extracted **teja-ai** folder where `server.py` and `START_TEJA_AI.bat` are located.
3. Double-click `START_TEJA_AI.bat`. Keep the server command window open.
4. Open `http://127.0.0.1:8000/` and press **Ctrl+F5** to hard-refresh if you previously used TEJA AI at this address.
5. Ask **Hello TEJA AI**. You should see a new item under **CHAT HISTORY**, with `✓ Saved on this device` below it. Refresh the page to verify that it stays.
6. Set **Language → Hindi**, click **🔊** to enable automatic speech, or click **🔉 Listen** next to a completed answer.

**Note**: If the system reports port 8000 already in use, close other `server.py` windows. Otherwise, use PowerShell inside the new teja-ai folder:

```powershell
$env:PORT = '8001'
py server.py
```

Then open `http://127.0.0.1:8001/` (same port as the running server).

## Local AI with no API bill

If not installed yet:

1. Install Ollama from https://ollama.com/download/windows
2. Run in PowerShell:
   ```powershell
   ollama pull qwen2.5:3b
   ollama run qwen2.5:3b
   ```
3. TEJA AI dropdown → **TEJA Local (Ollama)** or **TEJA AI Smart**. Smart mode prefers local Ollama when available.
4. **Google Search OFF** for local-only text chats.

Ollama model download is separate from this ZIP. See `http://127.0.0.1:8000/api/status` for model connection status.

## Where history is saved

Windows: `%LOCALAPPDATA%\TEJA-AI\history.sqlite3` (for example under `AppData\Local\TEJA-AI`).

macOS/Linux: `~/.local/share/TEJA-AI/history.sqlite3` unless `XDG_DATA_HOME` is set.

The database stays in the same location even when you replace the project ZIP/folder or use another browser. Back up with **⬇ Backup**. This history is **plain local data, not encrypted**, and everyone with access to your computer user account can read it. Do not store secrets or API keys in chat history.

Older versions used browser localStorage only. Old history still in browser storage can only migrate from the browser and exact origin where it was originally saved (scheme + hostname + port). For example, Edge `127.0.0.1:8000` and Chrome `127.0.0.1:8000` are different browser storage areas. If browser storage was cleared, old chats may be unrecoverable.

## Voice availability

- Browser-based `speechSynthesis` voices depend on installed OS/browser voices. To install languages/voices, check **Windows Settings → Time & language → Speech / Language & region**. Availability varies by Windows edition, pack, and language.
- Browser `SpeechRecognition` is not available everywhere, and may transmit audio to browser/cloud speech services; voice recognition is **not guaranteed offline**.
- Some languages may not have compatible voices installed; TEJA shows a warning. For unsupported languages, audio may be silent or use a fallback voice.
- For multilingual output, ask the AI **“Answer in Hindi (Devanagari)”**, etc., and choose the same language in TEJA's voice toolbar.
- TEJA uses text-to-speech playback, **not** a full real-time voice conversation model.

## Other notes

- Chat contents are sent to the selected provider for processing unless using local Ollama.
- Google Search is optional and requires separate Google Custom Search credentials.
- OpenAI API credits and ChatGPT subscription are billed separately.
- This is for a **local personal machine**, not a production/public server. Do not expose the backend to the public Internet without authentication, HTTPS, quotas, and security reviews.
- A previously shared image included a complete Gemini API key. **Revoke that exposed key** in Google AI Studio and make a fresh key. Never share screenshots showing keys and never commit them to GitHub.

## Files
- `server.py` — local server, model integration, and persistent history
- `public/app.js` — history, voice, chat, provider choices
- `public/index.html` — controls
- `public/style.css` — animated/glowing wolf interface
- `START_TEJA_AI.bat` — Windows launcher


## Developer / Creator
**VIVEK SAHU** is shown prominently in the sidebar, welcome section and footer. This is a branding-only update from v2.5; all previous voice, Ollama and history features remain unchanged. Chat history is stored outside the project folder under the user data directory.


---

## Website preview (GitHub Pages)

This repository includes a **sample-only** interactive GitHub Pages preview at `https://viveksahu1974.github.io/TEJA-AI/` once GitHub Pages is enabled and the deployment succeeds. It demonstrates the UI, sample replies, history stored in the browser and browser voice where supported. **This link is not guaranteed live until deployment is verified.** The demo **does not** call a real AI model or expose API keys.

To enable: repository **Settings → Pages → Source: GitHub Actions**, then Actions → **Deploy TEJA Preview to Pages** → **Run workflow**.

For full chat, voice through `edge-tts`, and persistent on-device SQLite history, use the Windows launcher and Python server as described above. The existing local server is **not suitable as an unauthenticated public multi-user service**: history endpoints are not separated per person. Do not put it on a public URL with private API keys unless you add authentication, per-user storage and rate limiting.
