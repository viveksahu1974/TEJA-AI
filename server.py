"""TEJA AI v2.2 - local Ollama + optional cloud models.
Offline AI through a local Ollama service, with optional cloud APIs.
"""
import ast
import asyncio
import importlib.util
import base64
import json
import mimetypes
import os
import re
import time
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'public'
HOST = os.getenv('HOST', '127.0.0.1')
PORT = int(os.getenv('PORT', '8000'))
# Saved outside the ZIP/project so replacing the TEJA AI folder does not delete chats.
DATA_HOME = Path(os.getenv('LOCALAPPDATA') or os.getenv('XDG_DATA_HOME') or (Path.home() / '.local' / 'share')) / 'TEJA-AI'
HISTORY_DB = DATA_HOME / 'history.sqlite3'

# Multilingual neural voices, used only when optional `edge-tts` is installed.
# This engine requires Internet access. The browser/Windows engine remains available.
MULTILINGUAL_VOICES = {
    'hi-IN': ('hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'),
    'en-IN': ('en-IN-NeerjaNeural', 'en-IN-PrabhatNeural'),
    'en-US': ('en-US-JennyNeural', 'en-US-GuyNeural'),
    'bn-IN': ('bn-IN-TanishaaNeural', 'bn-IN-BashkarNeural'),
    'ta-IN': ('ta-IN-PallaviNeural', 'ta-IN-ValluvarNeural'),
    'te-IN': ('te-IN-ShrutiNeural', 'te-IN-MohanNeural'),
    'mr-IN': ('mr-IN-AarohiNeural', 'mr-IN-ManoharNeural'),
    'gu-IN': ('gu-IN-DhwaniNeural', 'gu-IN-NiranjanNeural'),
    'kn-IN': ('kn-IN-SapnaNeural', 'kn-IN-GaganNeural'),
    'ml-IN': ('ml-IN-SobhanaNeural', 'ml-IN-MidhunNeural'),
    'pa-IN': ('pa-IN-VaaniNeural', 'pa-IN-OjasNeural'),
    'ur-PK': ('ur-PK-UzmaNeural', 'ur-PK-AsadNeural'),
    'or-IN': ('or-IN-SubhasiniNeural', 'or-IN-SukantNeural'),
    'ne-NP': ('ne-NP-HemkalaNeural', 'ne-NP-SagarNeural'),
    'ar-SA': ('ar-SA-ZariyahNeural', 'ar-SA-HamedNeural'),
    'es-ES': ('es-ES-ElviraNeural', 'es-ES-AlvaroNeural'),
    'fr-FR': ('fr-FR-DeniseNeural', 'fr-FR-HenriNeural'),
    'de-DE': ('de-DE-KatjaNeural', 'de-DE-ConradNeural'),
    'pt-BR': ('pt-BR-FranciscaNeural', 'pt-BR-AntonioNeural'),
    'ja-JP': ('ja-JP-NanamiNeural', 'ja-JP-KeitaNeural'),
    'ko-KR': ('ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'),
    'zh-CN': ('zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'),
    'ru-RU': ('ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural'),
}

def has_online_tts():
    return importlib.util.find_spec('edge_tts') is not None


def synthesize_multilingual_audio(text, language='hi-IN', speed=1.0, speaker='female'):
    """Generate short MP3 in memory. Network needed, never writes text/audio to disk."""
    if not isinstance(text, str) or not text.strip() or len(text) > 1800:
        raise ValueError('Voice text must be 1–1800 characters.')
    if language not in MULTILINGUAL_VOICES:
        raise ValueError('Choose a supported language in the TEJA voice toolbar.')
    if speaker not in ('female', 'male'):
        raise ValueError('Invalid voice selection.')
    if not isinstance(speed, (int, float)) or not 0.7 <= speed <= 1.4:
        raise ValueError('Invalid voice speed.')
    if not has_online_tts():
        raise RuntimeError('Online voice package missing. Run INSTALL_MULTILINGUAL_VOICE.bat in the teja-ai folder, then restart TEJA AI.')
    import edge_tts
    voice = MULTILINGUAL_VOICES[language][0 if speaker=='female' else 1]
    change = int(round((speed-1.0)*100))
    rate = f'{change:+d}%'

    async def generate():
        frames = bytearray()
        communication = edge_tts.Communicate(text, voice=voice, rate=rate)
        async for chunk in communication.stream():
            if chunk.get('type') == 'audio':
                frames.extend(chunk.get('data', b''))
                if len(frames) > 8_000_000:
                    raise RuntimeError('Generated audio is too large.')
        if not frames:
            raise RuntimeError('Speech service produced no audio.')
        return bytes(frames)
    return asyncio.run(asyncio.wait_for(generate(), timeout=55))



def db_connect():
    DATA_HOME.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(HISTORY_DB, timeout=8)
    db.execute('CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, data TEXT NOT NULL)')
    return db


def normalize_chat(chat):
    if not isinstance(chat, dict):
        raise ValueError('Invalid chat')
    chat_id = chat.get('id')
    if not isinstance(chat_id, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', chat_id):
        raise ValueError('Invalid chat identifier')
    messages = chat.get('messages', [])
    if not isinstance(messages, list) or len(messages) > 80:
        raise ValueError('Too many chat messages')
    clean_messages = []
    for m in messages:
        if not isinstance(m, dict) or m.get('role') not in ('user', 'assistant') or not isinstance(m.get('content'), str):
            raise ValueError('Invalid chat message')
        clean_messages.append({
            'role': m['role'],
            'content': m['content'][:25000],
            'meta': str(m.get('meta', ''))[:400],
        })
    updated_at = chat.get('updatedAt', 0)
    if not isinstance(updated_at, (float, int)) or not (0 < updated_at < 99999999999999):
        updated_at = int(time.time() * 1000)
    return {
        'id': chat_id,
        'title': str(chat.get('title', 'Conversation'))[:100] or 'Conversation',
        'mode': str(chat.get('mode', 'teja'))[:40],
        'provider': str(chat.get('provider', 'teja'))[:40],
        'updatedAt': int(updated_at),
        'messages': clean_messages,
    }


def load_chats():
    with db_connect() as db:
        rows = db.execute('SELECT data FROM chats ORDER BY updated_at DESC LIMIT 80').fetchall()
    return [json.loads(row[0]) for row in rows]


def persist_chat(chat):
    chat = normalize_chat(chat)
    with db_connect() as db:
        existing = db.execute('SELECT updated_at FROM chats WHERE id=?', (chat['id'],)).fetchone()
        if existing and int(existing[0]) > chat['updatedAt']:
            return {'ok': True, 'ignored': 'older version'}
        db.execute('INSERT INTO chats(id, updated_at, data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, data=excluded.data',
                   (chat['id'], chat['updatedAt'], json.dumps(chat, ensure_ascii=False)))
        db.execute('DELETE FROM chats WHERE id NOT IN (SELECT id FROM chats ORDER BY updated_at DESC LIMIT 80)')
    return {'ok': True}


def delete_chat(chat_id):
    if not isinstance(chat_id, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', chat_id):
        raise ValueError('Invalid chat identifier')
    with db_connect() as db:
        db.execute('DELETE FROM chats WHERE id=?', (chat_id,))
    return {'ok': True}


def clear_chats():
    with db_connect() as db:
        db.execute('DELETE FROM chats')
    return {'ok': True}


PROVIDERS = {
    'ollama': {
        'label': 'TEJA Local (Ollama)',
        'env': None,
        'model_env': 'OLLAMA_MODEL',
        'default_model': 'qwen2.5:3b',
    },
    'openai': {
        'label': 'ChatGPT',
        'env': 'OPENAI_API_KEY',
        'model_env': 'OPENAI_MODEL',
        'default_model': 'gpt-4.1-mini',
    },
    'gemini': {
        'label': 'Gemini',
        'env': 'GEMINI_API_KEY',
        'model_env': 'GEMINI_MODEL',
        'default_model': 'gemini-2.5-flash',
    },
    'claude': {
        'label': 'Claude',
        'env': 'ANTHROPIC_API_KEY',
        'model_env': 'ANTHROPIC_MODEL',
        'default_model': 'claude-3-5-sonnet-latest',
    },
    'deepseek': {
        'label': 'DeepSeek',
        'env': 'DEEPSEEK_API_KEY',
        'model_env': 'DEEPSEEK_MODEL',
        'default_model': 'deepseek-chat',
    },
}

PERSONA = (
    "You are TEJA AI, a friendly, capable all-rounder assistant. "
    "Be accurate, practical, and candid about limitations. Respond in the user's language "
    "(including Hindi/Hinglish). You help with studies, engineering, code, projects, writing, "
    "translation, productivity, and planning. If something is uncertain, say so clearly. "
    "Format answers in clear Markdown when useful."
)
MODE_PROMPTS = {
    'teja': 'Be TEJA AI: an excellent all-rounder with a clear, warm, practical personality. For Hindi/Hinglish, respond naturally in Hindi/Hinglish.',
    'general': 'Help the user with their request in a practical all-rounder style.',
    'study': 'Teach in simple, exam-friendly language with examples and steps.',
    'code': 'Write useful code, explain the key parts, and mention setup steps when needed.',
    'write': 'Draft and improve writing in the requested tone and structure.',
    'translate': 'Translate accurately while preserving meaning and tone.',
    'ideas': 'Brainstorm creative, concrete, actionable ideas.'
}


# TEJA AI Smart is a routing option, NOT a newly trained independent model.
# Prefer the local Ollama engine so no cloud API credits are needed when it is available.
SMART_PREFERENCES = {
    'teja': ('ollama', 'openai', 'gemini', 'claude', 'deepseek'),
    'general': ('ollama', 'openai', 'gemini', 'claude', 'deepseek'),
    'study': ('ollama', 'gemini', 'openai', 'claude', 'deepseek'),
    'code': ('ollama', 'deepseek', 'openai', 'claude', 'gemini'),
    'write': ('ollama', 'claude', 'openai', 'gemini', 'deepseek'),
    'translate': ('ollama', 'gemini', 'openai', 'claude', 'deepseek'),
    'ideas': ('ollama', 'openai', 'gemini', 'claude', 'deepseek'),
}


def choose_smart_provider(mode='teja'):
    """First available configured provider, with preferences by workspace."""
    return next((p for p in SMART_PREFERENCES.get(mode, SMART_PREFERENCES['teja'])
                 if provider_ready(p)), None)


def all_provider_status():
    chosen = choose_smart_provider('teja')
    status = {
        name: {'ready': provider_ready(name), 'label': cfg['label'], 'model': provider_model(name)}
        for name, cfg in PROVIDERS.items()
    }
    status['teja'] = {
        'ready': chosen is not None,
        'label': 'TEJA AI Smart',
        'model': f'Auto via {PROVIDERS[chosen]["label"]} ({provider_model(chosen)})' if chosen else 'Demo (install Ollama + model)',
        'via': chosen,
    }
    return status


# A short-lived cache avoids repeated polling when the UI requests status.
_ollama_check = {'at': 0.0, 'ready': False}


def ollama_ready() -> bool:
    now = time.monotonic()
    if now - _ollama_check['at'] < 4:
        return _ollama_check['ready']
    url = 'http://127.0.0.1:11434/api/tags'
    ready = False
    try:
        with urllib.request.urlopen(url, timeout=2) as resp:
            data = json.load(resp)
        target = provider_model('ollama')
        names = {m.get('name') for m in data.get('models', [])}
        ready = target in names or (':' not in target and target + ':latest' in names)
    except (urllib.error.URLError, TimeoutError, ValueError, OSError, TypeError):
        pass
    _ollama_check.update({'at': now, 'ready': ready})
    return ready


def provider_ready(name: str) -> bool:
    if name == 'ollama':
        return ollama_ready()
    cfg = PROVIDERS.get(name)
    return bool(cfg and cfg.get('env') and os.getenv(cfg['env'], '').strip())


def provider_model(name: str) -> str:
    cfg = PROVIDERS.get(name, PROVIDERS['openai'])
    return os.getenv(cfg['model_env'], cfg['default_model']).strip() or cfg['default_model']


def active_instructions(mode: str, search_context: str | None = None) -> str:
    text = PERSONA + "\nMode: " + MODE_PROMPTS.get(mode, MODE_PROMPTS['general'])
    if search_context:
        text += (
            "\nYou also have Google web search context below. Use it carefully, cite the source titles/URLs in plain text when relevant, "
            "and say if the search information is incomplete.\n\nGoogle search context:\n" + search_context
        )
    return text


def safe_calculate(expression):
    ops = {
        ast.Add: lambda a, b: a + b,
        ast.Sub: lambda a, b: a - b,
        ast.Mult: lambda a, b: a * b,
        ast.Div: lambda a, b: a / b,
        ast.FloorDiv: lambda a, b: a // b,
        ast.Mod: lambda a, b: a % b,
        ast.Pow: lambda a, b: a ** b,
    }

    def walk(node, depth=0):
        if depth > 15:
            raise ValueError('Expression too complex')
        if isinstance(node, ast.Expression):
            return walk(node.body, depth + 1)
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return node.value
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            n = walk(node.operand, depth + 1)
            return n if isinstance(node.op, ast.UAdd) else -n
        if isinstance(node, ast.BinOp) and type(node.op) in ops:
            a, b = walk(node.left, depth + 1), walk(node.right, depth + 1)
            if abs(a) > 1e12 or abs(b) > 1e12 or (isinstance(node.op, ast.Pow) and abs(b) > 12):
                raise ValueError('Number too large')
            return ops[type(node.op)](a, b)
        raise ValueError('Only arithmetic is supported')

    value = walk(ast.parse(expression, mode='eval'))
    if abs(value) > 1e18:
        raise ValueError('Result too large')
    return value


def offline_answer(question, mode, provider='openai'):
    q = question.strip()
    expr = re.sub(r'^(calculate|solve|what is|kitna hai|eval)\s*[: ]*', '', q, flags=re.I).strip().rstrip('?= ')
    if re.fullmatch(r'[\d\s.+*/()%\-]+', expr or 'X'):
        try:
            return f'**Answer:** `{safe_calculate(expr):,}`\n\nCalculated locally in demo mode.'
        except Exception:
            pass
    tips = {
        'study': 'I can explain concepts, create revision notes, exam answers, and practice questions.',
        'code': 'I can help with Python, JavaScript, React, debugging, and project ideas.',
        'write': 'I can draft emails, resumes, reports, captions, and applications.',
        'translate': 'I can translate between Hindi and English and other languages.',
        'ideas': 'I can brainstorm project ideas, product features, and plans.',
        'general': 'I can answer questions across studying, coding, writing, productivity, and more.'
    }
    label = 'TEJA AI Smart' if provider == 'teja' else PROVIDERS.get(provider, PROVIDERS['openai'])['label']
    return (
        f'**TEJA AI — Demo Mode ({label})** ✨\n\n' + tips.get(mode, tips['general']) +
        '\n\nYour message: **' + q[:280].replace('*', '') + '**\n\n' +
        'This is a local preview, **not a real AI-generated answer**. To use TEJA offline, install Ollama from https://ollama.com/download/windows, then run `ollama pull qwen2.5:3b`. '
        'Refresh the page and choose TEJA AI Smart or TEJA Local (Ollama). No paid OpenAI credits required.'
    )


def parse_image_data(image: str | None):
    if not image:
        return None
    if not image.startswith('data:image/') or len(image) > 7_000_000:
        raise ValueError('Invalid or oversized image (max approximately 5 MB).')
    header, b64data = image.split(',', 1)
    mime = header.split(';', 1)[0][5:]
    return {'data_url': image, 'mime': mime, 'b64': b64data}


def trim_history(messages):
    history = []
    for entry in messages[-16:]:
        role = entry.get('role')
        content = entry.get('content', '')
        if role not in ('user', 'assistant') or not isinstance(content, str):
            continue
        history.append({'role': role, 'content': content[:12000]})
    return history


def google_search(query: str):
    api_key = os.getenv('GOOGLE_CSE_API_KEY', '').strip()
    cx = os.getenv('GOOGLE_CSE_CX', '').strip()
    if not api_key or not cx:
        return None, 'Google search is not configured. Add GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX.'
    params = urllib.parse.urlencode({'key': api_key, 'cx': cx, 'q': query, 'num': 5})
    url = f'https://www.googleapis.com/customsearch/v1?{params}'
    try:
        with urllib.request.urlopen(url, timeout=25) as response:
            data = json.load(response)
        items = data.get('items', [])
        if not items:
            return 'No Google results found.', None
        lines = []
        for i, item in enumerate(items[:5], start=1):
            title = item.get('title', 'Untitled')
            snippet = item.get('snippet', '')
            link = item.get('link', '')
            lines.append(f'{i}. {title}\n   {snippet}\n   {link}')
        return '\n'.join(lines), None
    except urllib.error.HTTPError as exc:
        try:
            details = json.loads(exc.read().decode()).get('error', {}).get('message', 'Google search API error')
        except Exception:
            details = 'Google search API error'
        return None, f'Google search error ({exc.code}): {details[:250]}'
    except Exception:
        return None, 'Could not reach Google search.'


def call_openai(history, instructions, image_info=None):
    key = os.getenv('OPENAI_API_KEY', '').strip()
    model = provider_model('openai')
    if image_info and history and history[-1]['role'] == 'user':
        history = history.copy()
        history[-1] = {
            'role': 'user',
            'content': [
                {'type': 'input_text', 'text': history[-1]['content']},
                {'type': 'input_image', 'image_url': image_info['data_url']},
            ],
        }
    payload = json.dumps({
        'model': model,
        'instructions': instructions,
        'input': history,
        'max_output_tokens': 1600,
    }).encode()
    request = urllib.request.Request(
        'https://api.openai.com/v1/responses',
        payload,
        headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.load(response)
        output = []
        for item in data.get('output', []):
            for part in item.get('content', []):
                if part.get('type') == 'output_text':
                    output.append(part.get('text', ''))
        return {'reply': '\n'.join(output).strip() or 'The model returned no text.', 'model': model}
    except urllib.error.HTTPError as exc:
        try:
            details = json.loads(exc.read().decode()).get('error', {}).get('message', 'API error')
        except Exception:
            details = 'API error'
        return {'error': f'OpenAI API error ({exc.code}): {details[:350]}'}
    except Exception:
        return {'error': 'Could not reach the OpenAI API.'}


def call_gemini(history, instructions, image_info=None):
    key = os.getenv('GEMINI_API_KEY', '').strip()
    model = provider_model('gemini')
    contents = []
    for idx, msg in enumerate(history):
        role = 'model' if msg['role'] == 'assistant' else 'user'
        parts = [{'text': msg['content']}]
        if image_info and idx == len(history) - 1 and role == 'user':
            parts.append({'inline_data': {'mime_type': image_info['mime'], 'data': image_info['b64']}})
        contents.append({'role': role, 'parts': parts})
    payload = json.dumps({
        'system_instruction': {'parts': [{'text': instructions}]},
        'contents': contents,
        'generationConfig': {'temperature': 0.7, 'maxOutputTokens': 1600},
    }).encode()
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(model)}:generateContent?key={urllib.parse.quote(key)}'
    request = urllib.request.Request(url, payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.load(response)
        texts = []
        for candidate in data.get('candidates', []):
            for part in candidate.get('content', {}).get('parts', []):
                if 'text' in part:
                    texts.append(part['text'])
        return {'reply': '\n'.join(texts).strip() or 'The model returned no text.', 'model': model}
    except urllib.error.HTTPError as exc:
        try:
            details = json.loads(exc.read().decode()).get('error', {}).get('message', 'API error')
        except Exception:
            details = 'API error'
        return {'error': f'Gemini API error ({exc.code}): {details[:350]}'}
    except Exception:
        return {'error': 'Could not reach the Gemini API.'}


def call_claude(history, instructions, image_info=None):
    key = os.getenv('ANTHROPIC_API_KEY', '').strip()
    model = provider_model('claude')
    messages = []
    for idx, msg in enumerate(history):
        content = [{'type': 'text', 'text': msg['content']}]
        if image_info and idx == len(history) - 1 and msg['role'] == 'user':
            content.append({
                'type': 'image',
                'source': {'type': 'base64', 'media_type': image_info['mime'], 'data': image_info['b64']},
            })
        messages.append({'role': msg['role'], 'content': content})
    payload = json.dumps({
        'model': model,
        'max_tokens': 1600,
        'system': instructions,
        'messages': messages,
    }).encode()
    request = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        payload,
        headers={
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.load(response)
        texts = [part.get('text', '') for part in data.get('content', []) if part.get('type') == 'text']
        return {'reply': ''.join(texts).strip() or 'The model returned no text.', 'model': model}
    except urllib.error.HTTPError as exc:
        try:
            details = json.loads(exc.read().decode()).get('error', {}).get('message', 'API error')
        except Exception:
            details = 'API error'
        return {'error': f'Claude API error ({exc.code}): {details[:350]}'}
    except Exception:
        return {'error': 'Could not reach the Claude API.'}


def call_deepseek(history, instructions):
    key = os.getenv('DEEPSEEK_API_KEY', '').strip()
    model = provider_model('deepseek')
    messages = [{'role': 'system', 'content': instructions}] + history
    payload = json.dumps({'model': model, 'messages': messages, 'max_tokens': 1600, 'temperature': 0.7}).encode()
    request = urllib.request.Request(
        'https://api.deepseek.com/v1/chat/completions',
        payload,
        headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.load(response)
        choice = (data.get('choices') or [{}])[0]
        text = choice.get('message', {}).get('content', '')
        return {'reply': text.strip() or 'The model returned no text.', 'model': model}
    except urllib.error.HTTPError as exc:
        try:
            details = json.loads(exc.read().decode()).get('error', {}).get('message', 'API error')
        except Exception:
            details = 'API error'
        return {'error': f'DeepSeek API error ({exc.code}): {details[:350]}'}
    except Exception:
        return {'error': 'Could not reach the DeepSeek API.'}


def call_ollama(history, instructions, image_info=None):
    """Call only a local loopback Ollama instance: no keys or remote endpoint."""
    model = provider_model('ollama')
    messages = [{'role': 'system', 'content': instructions}] + [dict(m) for m in history]
    if image_info:
        return {'error': 'The selected qwen2.5:3b model is text-only. For image questions, switch to a provider with image support.'}
    request_body = json.dumps({
        'model': model,
        'messages': messages,
        'stream': False,
        'options': {'num_predict': 1200, 'num_ctx': 4096},
    }, ensure_ascii=False).encode('utf-8')
    request = urllib.request.Request(
        'http://127.0.0.1:11434/api/chat',
        data=request_body,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=240) as response:
            data = json.load(response)
        reply = data.get('message', {}).get('content', '').strip()
        return {'reply': reply or 'The local model returned no text.', 'model': model}
    except urllib.error.HTTPError as exc:
        try:
            info = json.loads(exc.read().decode('utf-8')).get('error', 'Local model error')
        except Exception:
            info = 'Local model error'
        return {'error': f'Ollama error ({exc.code}): {str(info)[:300]}'}
    except (urllib.error.URLError, TimeoutError, OSError):
        return {'error': 'Cannot reach Ollama at http://127.0.0.1:11434. Start Ollama, run `ollama pull qwen2.5:3b`, and retry.'}
    except (ValueError, TypeError):
        return {'error': 'Ollama returned an unexpected response.'}


def ask_ai(messages, mode, provider='openai', web_search=False, image=None):
    requested_provider = provider if provider in (*PROVIDERS, 'teja') else 'teja'
    smart = requested_provider == 'teja'
    provider = choose_smart_provider(mode) if smart else requested_provider
    try:
        image_info = parse_image_data(image)
    except ValueError as exc:
        return {'error': str(exc)}

    history = trim_history(messages)
    latest_question = history[-1]['content'] if history else ''
    search_context = None
    search_note = None
    if web_search and latest_question:
        search_context, search_note = google_search(latest_question)
    instructions = active_instructions(mode, search_context)

    if not provider or not provider_ready(provider):
        return {
            'reply': offline_answer(latest_question, mode, requested_provider),
            'demo': True,
            'provider': requested_provider,
            'provider_label': 'TEJA AI Smart' if smart else PROVIDERS[requested_provider]['label'],
            'model': 'Demo' if smart else provider_model(requested_provider),
            'search_note': search_note,
        }

    if provider == 'ollama':
        result = call_ollama(history, instructions, image_info)
    elif provider == 'openai':
        result = call_openai(history, instructions, image_info)
    elif provider == 'gemini':
        result = call_gemini(history, instructions, image_info)
    elif provider == 'claude':
        result = call_claude(history, instructions, image_info)
    else:
        result = call_deepseek(history, instructions)

    result['provider'] = requested_provider
    result['actual_provider'] = provider
    result['provider_label'] = ('TEJA AI via ' if smart else '') + PROVIDERS[provider]['label']
    if search_note:
        result['search_note'] = search_note
    elif search_context:
        result['search_note'] = 'Google search context used.'
    return result


class Handler(BaseHTTPRequestHandler):
    def json_out(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/api/history':
            try:
                return self.json_out({'chats': load_chats(), 'storage': 'device'})
            except (OSError, sqlite3.Error):
                return self.json_out({'error': 'Cannot read chat history on this device.'}, 500)
        if path == '/api/history/export':
            try:
                body = json.dumps({'format': 'teja-ai-history-v1', 'chats': load_chats()}, ensure_ascii=False, indent=2).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Disposition', 'attachment; filename=teja-ai-history.json')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            except (OSError, sqlite3.Error):
                return self.json_out({'error': 'Cannot export history.'}, 500)
        if path == '/api/status':
            return self.json_out({
                'connected': any(provider_ready(name) for name in PROVIDERS),
                'providers': all_provider_status(),
                'google_search': bool(os.getenv('GOOGLE_CSE_API_KEY', '').strip() and os.getenv('GOOGLE_CSE_CX', '').strip()),
                'tts_online_installed': has_online_tts(),
                'tts_online_languages': list(MULTILINGUAL_VOICES),
            })
        if path == '/':
            path = '/index.html'
        target = (ROOT / path.lstrip('/')).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            return self.json_out({'error': 'Not found'}, 404)
        raw = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(target.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def audio_out(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'audio/mpeg')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        # Reject cross-site writes to this local server.
        origin = self.headers.get('Origin', '')
        if origin and origin not in (f'http://127.0.0.1:{PORT}', f'http://localhost:{PORT}'):
            return self.json_out({'error': 'Cross-origin requests are not permitted'}, 403)
        if self.path == '/api/tts':
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length < 2 or length > 18000:
                    return self.json_out({'error': 'Voice request too long.'}, 413)
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    return self.json_out({'error': 'Invalid voice request'}, 400)
                audio = synthesize_multilingual_audio(data.get('text'), data.get('language', 'hi-IN'), data.get('speed', 1), data.get('speaker', 'female'))
                return self.audio_out(audio)
            except (ValueError, TypeError):
                return self.json_out({'error': 'Choose a supported language and text shorter than 1800 characters.'}, 400)
            except RuntimeError as exc:
                return self.json_out({'error': str(exc)[:450]}, 503)
            except Exception:
                # Do not expose URLs, headers, credentials or full exception details in UI.
                return self.json_out({'error': 'Online multilingual voice unavailable. Check internet access, the edge-tts installation, then retry. You can switch to Windows/browser voice meanwhile.'}, 502)
        if self.path in ('/api/history', '/api/history/delete', '/api/history/clear'):
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length < 2 or length > 2_500_000:
                    return self.json_out({'error': 'Invalid history request size'}, 413)
                data = json.loads(self.rfile.read(length))
                if self.path == '/api/history':
                    result = persist_chat(data.get('chat'))
                elif self.path == '/api/history/delete':
                    result = delete_chat(data.get('id'))
                else:
                    result = clear_chats()
                return self.json_out(result)
            except (ValueError, TypeError):
                return self.json_out({'error': 'Invalid history data'}, 400)
            except (OSError, sqlite3.Error):
                return self.json_out({'error': 'Could not save history on this device.'}, 500)
        if self.path != '/api/chat':
            return self.json_out({'error': 'Not found'}, 404)
        length = int(self.headers.get('Content-Length', '0'))
        if length < 2 or length > 8_000_000:
            return self.json_out({'error': 'Request too large or empty'}, 413)
        try:
            data = json.loads(self.rfile.read(length))
            messages = data.get('messages', [])
            mode = data.get('mode', 'general')
            provider = data.get('provider', 'openai')
            web_search = bool(data.get('webSearch'))
            if not isinstance(messages, list) or not messages or len(messages) > 80:
                return self.json_out({'error': 'Invalid conversation'}, 400)
            if messages[-1].get('role') != 'user' or not isinstance(messages[-1].get('content'), str) or not messages[-1]['content'].strip():
                return self.json_out({'error': 'Message required'}, 400)
            self.json_out(ask_ai(messages, mode, provider, web_search, data.get('image')))
        except (ValueError, TypeError, KeyError):
            self.json_out({'error': 'Bad request'}, 400)

    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    live = [cfg['label'] for name, cfg in PROVIDERS.items() if provider_ready(name)]
    print(f'TEJA AI v2.5 running at http://{HOST}:{PORT}', flush=True)
    print('Connected providers: ' + (', '.join(live) if live else 'Demo only (Ollama not ready)'), flush=True)
    print('Online multilingual voice: ' + ('installed' if has_online_tts() else 'not installed (run INSTALL_MULTILINGUAL_VOICE.bat)'), flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
