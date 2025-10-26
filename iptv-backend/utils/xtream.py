import requests
from urllib.parse import urlparse

def connect_xtream(base_url: str, username: str, password: str):
    """
    Baut eine Verbindung zum Xtream-Server auf und liefert Benutzer- und Serverinformationen zurück.
    """

    # ========================================
    # 🧩 URL-Validierung & Bereinigung
    # ========================================
    if not base_url:
        raise Exception("Fehler: Keine Base-URL angegeben.")

    # Falls der Nutzer nur 'm3u.best-smarter.me' eingibt → automatisch http:// hinzufügen
    if not base_url.startswith("http"):
        base_url = "http://" + base_url

    # Falls der Nutzer z. B. "http://m3u.best-smarter.me:80" eingibt → normalisieren
    parsed = urlparse(base_url)
    clean_url = f"{parsed.scheme}://{parsed.netloc}"

    # API-Endpunkt
    api_url = f"{clean_url.rstrip('/')}/player_api.php?username={username}&password={password}"
    print(f"🌍 Prüfe Verbindung zu: {api_url}")

    try:
        # ========================================
        # 🔌 Anfrage an Xtream-Server senden
        # ========================================
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()

        # JSON-Validierung
        try:
            data = response.json()
        except ValueError:
            raise Exception("Ungültige Serverantwort – keine JSON-Daten erhalten.")

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

        return {
            "status": "success",
            "message": "✅ Verbindung erfolgreich",
            "user_info": user_info,
            "server_info": data.get("server_info"),
        }

    except requests.exceptions.ConnectionError:
        raise Exception("Keine Verbindung möglich – Server offline oder URL falsch.")
    except requests.exceptions.Timeout:
        raise Exception("Zeitüberschreitung – Server antwortet zu langsam.")
    except requests.exceptions.HTTPError as e:
        raise Exception(f"HTTP-Fehler: {e.response.status_code}")
    except Exception as e:
        raise Exception(f"Unerwarteter Fehler: {str(e)}")