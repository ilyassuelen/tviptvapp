from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
import requests
import os
import re
import json
from urllib.parse import urlparse, unquote
from fastapi.responses import StreamingResponse

PROXY_BASE = "http://127.0.0.1:8080/proxy?url="

# ====================================================
# 🚀 IPTV Backend – Haupt-App
# ====================================================
app = FastAPI(title="IPTV Backend", version="2.1.0")

# ====================================================
# 🌍 CORS aktivieren
# ====================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================================================
# 🔑 TMDB API
# ====================================================
TMDB_API_KEY = "2c4a1c9246f6cbe59f3d7bce2d7e6c4a"
TMDB_BASE_URL = "https://api.themoviedb.org/3"

# ====================================================
# 📂 Speicherpfad
# ====================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SESSIONS_FILE = os.path.join(BASE_DIR, "sessions.json")

# ====================================================
# ✅ Root
# ====================================================
@app.get("/")
def root():
    return {"message": "✅ IPTV Backend läuft erfolgreich!"}

# ====================================================
# 🔐 Xtream-Verbindung (mit Film- & Serienkategorien)
# ====================================================
@app.post("/auth/connect-xtream")
async def connect_xtream_route(request: Request):
    try:
        data = await request.json()
        base_url = data.get("base_url", "").strip()
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()

        if not all([base_url, username, password]):
            raise HTTPException(status_code=400, detail="❌ Fehlende Parameter: base_url, username, password")

        if not base_url.startswith("http"):
            base_url = "http://" + base_url

        parsed = urlparse(base_url)
        clean_url = f"{parsed.scheme}://{parsed.netloc}"
        api_url = f"{clean_url.rstrip('/')}/player_api.php?username={username}&password={password}"

        print(f"📡 Verbinde zu Xtream API: {api_url}")

        # Session vorbereiten
        session = requests.Session()
        session.headers.update({
            "User-Agent": "IPTVSmartersPlayer/1.0",
            "Accept": "*/*",
            "Connection": "keep-alive"
        })

        # Verbindung prüfen
        try:
            response = session.get(api_url, timeout=10)
            response.raise_for_status()
        except requests.exceptions.ConnectionError:
            print("⚠️ HTTP fehlgeschlagen – HTTPS wird NICHT versucht (Server unterstützt kein HTTPS)")
            raise HTTPException(status_code=502, detail="Verbindung zum Xtream-Server (HTTP) fehlgeschlagen.")

        data_json = response.json()
        user_info = data_json.get("user_info", {})
        if not user_info or not user_info.get("auth"):
            raise HTTPException(status_code=401, detail="❌ Ungültige Zugangsdaten")

        print(f"✅ Login erfolgreich – Benutzer: {user_info.get('username')}")

        # === Kategorien, Kanäle, Filme & Serien abrufen ===
        params = {"username": username, "password": password}
        server_url = f"{clean_url}/player_api.php"

        print("📥 Lade Kategorien, Kanäle, Filme & Serien ...")

        # Live-Daten
        cat_response = session.get(server_url, params={**params, "action": "get_live_categories"}, timeout=20)
        ch_response = session.get(server_url, params={**params, "action": "get_live_streams"}, timeout=30)

        # Film- und Serien-Daten
        vod_cat_response = session.get(server_url, params={**params, "action": "get_vod_categories"}, timeout=20)
        vod_response = session.get(server_url, params={**params, "action": "get_vod_streams"}, timeout=30)
        series_cat_response = session.get(server_url, params={**params, "action": "get_series_categories"}, timeout=20)
        series_response = session.get(server_url, params={**params, "action": "get_series"}, timeout=30)

        # Ergebnisse
        categories = cat_response.json() if cat_response.status_code == 200 else []
        channels = ch_response.json() if ch_response.status_code == 200 else []
        vod_categories = vod_cat_response.json() if vod_cat_response.status_code == 200 else []
        movies = vod_response.json() if vod_response.status_code == 200 else []
        series_categories = series_cat_response.json() if series_cat_response.status_code == 200 else []
        series = series_response.json() if series_response.status_code == 200 else []

        print(f"📊 Live={len(categories)} | Movies={len(vod_categories)} | Series={len(series_categories)}")
        print(f"📺 Sender={len(channels)} | 🎬 Filme={len(movies)} | 📚 Serien={len(series)}")

        # Session speichern
        with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "base_url": clean_url,
                "username": username,
                "password": password,
                "user_info": user_info,
                "live_categories": categories,
                "vod_categories": vod_categories,
                "series_categories": series_categories,
                "channels": channels,
                "movies": movies,
                "series": series
            }, f, indent=2, ensure_ascii=False)

        return {"status": "success", "message": "✅ Xtream erfolgreich verbunden"}

    except Exception as e:
        print("❌ FEHLER in /auth/connect-xtream:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================
# 🧩 M3U-Verbindung
# ====================================================
@app.post("/auth/connect-m3u")
async def connect_m3u_route(request: Request):
    try:
        data = await request.json()
        m3u_url = data.get("m3u_url")
        playlist_name = data.get("playlist_name", "M3U")

        if not m3u_url:
            raise HTTPException(status_code=400, detail="❌ Fehlender Parameter: m3u_url")

        print(f"📡 Lade M3U Playlist von {m3u_url}")

        session = requests.Session()
        session.headers.update({"User-Agent": "IPTVSmartersPlayer/1.0", "Accept": "*/*", "Connection": "keep-alive"})
        response = session.get(m3u_url, timeout=20)
        response.raise_for_status()

        lines = response.text.splitlines()
        channels, current = [], {}

        for line in lines:
            line = line.strip()
            if line.startswith("#EXTINF:"):
                current = {}
                parts = line.split(",")
                if len(parts) > 1:
                    current["name"] = parts[-1]
                if 'tvg-logo="' in line:
                    current["stream_icon"] = line.split('tvg-logo="')[1].split('"')[0]
                if 'group-title="' in line:
                    current["category_name"] = line.split('group-title="')[1].split('"')[0]
            elif line and not line.startswith("#"):
                current["stream_url"] = line
                channels.append(current)

        if not channels:
            raise HTTPException(status_code=400, detail="❌ Keine Sender in der M3U-Datei gefunden")

        categories = sorted(set(ch.get("category_name", "Unbekannt") for ch in channels))
        print(f"✅ {len(channels)} Sender aus M3U geladen ({len(categories)} Kategorien)")

        with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "playlist_name": playlist_name,
                "m3u_url": m3u_url,
                "categories": categories,
                "channels": channels
            }, f, indent=2, ensure_ascii=False)

        return {"status": "success", "message": f"✅ M3U erfolgreich geladen ({len(channels)} Sender)"}

    except Exception as e:
        print("❌ Fehler in /auth/connect-m3u:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================
# 🎬 TMDB Trending
# ====================================================
@app.get("/home/trending/{playlist}")
def get_trending(playlist: str):
    print(f"📺 Anfrage nach Trending-Inhalten für Playlist: {playlist}")
    try:
        params = {"api_key": TMDB_API_KEY, "language": "de-DE"}
        movies = requests.get(f"{TMDB_BASE_URL}/trending/movie/week", params=params, timeout=10).json().get("results", [])
        series = requests.get(f"{TMDB_BASE_URL}/trending/tv/week", params=params, timeout=10).json().get("results", [])

        combined = [
            {"title": m.get("title"), "poster": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}", "category": "Movie"}
            for m in movies if m.get("poster_path")
        ] + [
            {"title": s.get("name"), "poster": f"https://image.tmdb.org/t/p/w500{s.get('poster_path')}", "category": "Series"}
            for s in series if s.get("poster_path")
        ]
        return {"status": "success", "playlist": playlist, "trending": combined}
    except Exception as e:
        print(f"⚠️ TMDB-Fehler: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================
# 📺 Kategorien & Kanäle
# ====================================================
@app.get("/iptv/categories")
def get_iptv_categories():
    try:
        if not os.path.exists(SESSIONS_FILE):
            raise HTTPException(status_code=404, detail="Keine gespeicherte Session gefunden")
        with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        categories = data.get("live_categories", [])
        if not categories:
            return {"status": "empty", "categories": []}
        if isinstance(categories[0], str):
            categories = [{"category_name": c} for c in categories]
        return {"status": "success", "count": len(categories), "categories": categories}
    except Exception as e:
        print("❌ Fehler bei /iptv/categories:", e)
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================
# 📺 Kanäle pro Kategorie
# ====================================================
@app.get("/iptv/channels")
def get_channels(category: str = Query(None)):
    try:
        if not os.path.exists(SESSIONS_FILE):
            raise HTTPException(status_code=404, detail="Keine gespeicherte Session gefunden")

        with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        channels = data.get("channels", [])
        categories = data.get("live_categories", [])
        if not channels:
            raise HTTPException(status_code=404, detail="Keine Kanäle gefunden")

        # 🔍 Wenn Kategorie angegeben ist:
        if category:
            # 1️⃣ Falls es eine ID ist, direkt nach ID filtern
            if category.isdigit():
                filtered = [ch for ch in channels if str(ch.get("category_id")) == category]

            else:
                # 2️⃣ Wenn Text → passende category_id anhand des Namens finden
                matched_category = next(
                    (
                        c for c in categories
                        if c.get("category_name", "").strip().lower() == category.strip().lower()
                    ),
                    None
                )

                if matched_category:
                    cat_id = str(matched_category.get("category_id"))
                    filtered = [ch for ch in channels if str(ch.get("category_id")) == cat_id]
                    print(f"✅ Kategorie '{category}' erkannt als ID {cat_id} → {len(filtered)} Sender gefunden")
                else:
                    filtered = []
                    print(f"⚠️ Keine Kategorie-ID gefunden für '{category}'")

        else:
            filtered = channels

        return {"status": "success", "count": len(filtered), "channels": filtered}

    except Exception as e:
        print("❌ Fehler bei /iptv/channels:", e)
        raise HTTPException(status_code=500, detail=str(e))

# ====================================================
# 🎬 Filme & Serien
# ====================================================
def load_session():
    if not os.path.exists(SESSIONS_FILE):
        raise HTTPException(status_code=404, detail="Keine gespeicherte Session gefunden")
    with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/iptv/movies")
def get_movies():
    data = load_session()
    movies = data.get("movies", [])
    vod_categories = data.get("vod_categories", [])
    if not movies:
        raise HTTPException(status_code=404, detail="Keine Filme gefunden")
    cat_map = {str(c["category_id"]): c["category_name"] for c in vod_categories if c.get("category_id")}
    for movie in movies:
        movie["category_name"] = cat_map.get(str(movie.get("category_id")), "Unbekannt")
    return {"status": "success", "count": len(movies), "movies": movies}

@app.get("/iptv/series")
def get_series():
    data = load_session()
    series = data.get("series", [])
    series_categories = data.get("series_categories", [])
    if not series:
        raise HTTPException(status_code=404, detail="Keine Serien gefunden")
    cat_map = {str(c["category_id"]): c["category_name"] for c in series_categories if c.get("category_id")}
    for s in series:
        s["category_name"] = cat_map.get(str(s.get("category_id")), "Unbekannt")
    return {"status": "success", "count": len(series), "series": series}

# ====================================================
# 📁 Session-Datei bereitstellen
# ====================================================
@app.get("/sessions.json")
def get_sessions():
    if not os.path.exists(SESSIONS_FILE):
        return JSONResponse({"detail": "sessions.json not found"}, status_code=404)
    try:
        with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
            return JSONResponse(json.load(f))
    except Exception as e:
        return JSONResponse({"detail": f"Fehler beim Lesen der Datei: {str(e)}"}, status_code=500)

# ====================================================
# 📡 Proxy-Route zum Streamen externer URLs (z.B. M3U8/TS)
# ====================================================
@app.get("/proxy")
def proxy(url: str, request: Request):
    try:
        headers = {}
        # Weiterleiten von wichtigen Headers
        for header_name in ["range", "user-agent", "referer", "origin"]:
            header_value = request.headers.get(header_name)
            if header_value:
                headers[header_name] = header_value

        resp = requests.get(url, headers=headers, stream=True, timeout=30)
        resp.raise_for_status()

        def iter_stream():
            try:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk
            finally:
                resp.close()

        return StreamingResponse(iter_stream(), status_code=resp.status_code, headers=dict(resp.headers))
    except Exception as e:
        return JSONResponse({"detail": f"Proxy-Fehler: {str(e)}"}, status_code=500)