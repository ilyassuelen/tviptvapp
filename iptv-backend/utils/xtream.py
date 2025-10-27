import requests
from urllib.parse import urlparse

PROXY_BASE = "http://87.106.10.34:8085/proxy?url="


def connect_xtream(base_url: str, username: str, password: str):
    """
    Baut eine stabile Verbindung zum Xtream-Server auf, prüft Login
    und lädt zusätzlich Kategorien, Kanäle, Filme und Serien.
    """

    # ========================================
    # 🧩 URL-Validierung & Bereinigung
    # ========================================
    if not base_url:
        raise Exception("Fehler: Keine Base-URL angegeben.")

    if not base_url.startswith("http"):
        base_url = "http://" + base_url

    parsed = urlparse(base_url)
    clean_url = f"{parsed.scheme}://{parsed.netloc}"

    # API-Endpunkt
    api_url = f"{clean_url.rstrip('/')}/player_api.php?username={username}&password={password}"
    print(f"🌍 Prüfe Verbindung zu: {api_url}")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Connection": "keep-alive",
        "Accept-Encoding": "gzip, deflate",
    }

    # ========================================
    # 🔌 Verbindung prüfen
    # ========================================
    try:
        response = requests.get(f"{PROXY_BASE}{api_url}", headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.ConnectionError:
        if not base_url.startswith("https"):
            https_url = base_url.replace("http://", "https://", 1)
            print(f"🔁 HTTP fehlgeschlagen, versuche HTTPS: {https_url}")
            api_url = f"{https_url.rstrip('/')}/player_api.php?username={username}&password={password}"
            response = requests.get(f"{PROXY_BASE}{api_url}", headers=headers, timeout=10, verify=False)
            response.raise_for_status()
            data = response.json()
        else:
            raise Exception("Keine Verbindung möglich – Server offline oder URL blockiert.")
    except requests.exceptions.Timeout:
        raise Exception("Zeitüberschreitung – Server antwortet zu langsam.")
    except requests.exceptions.HTTPError as e:
        raise Exception(f"HTTP-Fehler: {e.response.status_code}")
    except ValueError:
        raise Exception("Ungültige Serverantwort – keine JSON-Daten erhalten.")
    except Exception as e:
        raise Exception(f"Unerwarteter Fehler: {str(e)}")

    # ========================================
    # ✅ Erfolgreiche Verbindung prüfen
    # ========================================
    user_info = data.get("user_info")
    if not user_info:
        raise Exception("Fehler: Keine 'user_info' in der Serverantwort gefunden.")

    if not user_info.get("auth"):
        msg = user_info.get("message", "❌ Login fehlgeschlagen")
        raise Exception(f"Ungültige Zugangsdaten: {msg}")

    print(f"✅ Verbindung erfolgreich – Benutzer: {username}, Status: {user_info.get('status')}")

    # ========================================
    # 📺 Kategorien, Kanäle, Filme & Serien abrufen
    # ========================================
    server_url = f"{clean_url.rstrip('/')}/player_api.php"
    params = {"username": username, "password": password}

    # Live-Kategorien abrufen
    cat_response = requests.get(f"{PROXY_BASE}{server_url}", params={**params, "action": "get_live_categories"}, timeout=10)
    live_categories = cat_response.json() if cat_response.status_code == 200 else []

    # Live-Sender abrufen
    ch_response = requests.get(f"{PROXY_BASE}{server_url}", params={**params, "action": "get_live_streams"}, timeout=15)
    live_channels = ch_response.json() if ch_response.status_code == 200 else []

    # 🎬 Filme abrufen
    vod_response = requests.get(f"{PROXY_BASE}{server_url}", params={**params, "action": "get_vod_streams"}, timeout=15)
    movies = vod_response.json() if vod_response.status_code == 200 else []

    # 📺 Serien abrufen
    series_response = requests.get(f"{PROXY_BASE}{server_url}", params={**params, "action": "get_series"}, timeout=15)
    series = series_response.json() if series_response.status_code == 200 else []

    print(
        f"📊 Übersicht:\n"
        f"  🧭 {len(live_categories)} Live-Kategorien\n"
        f"  📺 {len(live_channels)} Live-Kanäle\n"
        f"  🎬 {len(movies)} Filme (VOD)\n"
        f"  📚 {len(series)} Serien"
    )

    # ========================================
    # 🧾 Rückgabe
    # ========================================
    return {
        "status": "success",
        "message": "✅ Verbindung erfolgreich",
        "user_info": user_info,
        "server_info": data.get("server_info"),
        "categories": live_categories,
        "channels": live_channels,
        "movies": movies,   # ✅ Neu hinzugefügt
        "series": series    # ✅ Neu hinzugefügt
    }