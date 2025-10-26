from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
from utils.xtream import connect_xtream

# ====================================================
# 🚀 IPTV Backend – Haupt-App
# ====================================================
app = FastAPI(title="IPTV Backend", version="1.0.0")

# ====================================================
# 🌍 CORS aktivieren (Kommunikation mit Expo App)
# ====================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # Später spezifisch machen (z. B. nur deine App-URL)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================================================
# ✅ Root-Route (Statuscheck)
# ====================================================
@app.get("/")
def root():
    return {"message": "✅ IPTV Backend läuft erfolgreich!"}

# ====================================================
# 🔐 Xtream-Verbindung (Login)
# ====================================================
@app.post("/auth/connect-xtream")
async def connect_xtream_route(request: Request):
    """
    Verbindet sich mit einem Xtream-Server und prüft die Login-Daten.
    Erwartet JSON:
    {
        "base_url": "http://example.com",
        "username": "abc",
        "password": "xyz"
    }
    """
    try:
        data = await request.json()
        base_url = data.get("base_url")
        username = data.get("username")
        password = data.get("password")
        playlist_name = data.get("playlist_name", "Xtream")

        if not all([base_url, username, password]):
            raise HTTPException(status_code=400, detail="Fehlende Parameter: base_url, username oder password fehlen.")

        print(f"📡 Verbindungstest zu {base_url} mit Benutzer: {username}")

        # Versuch, Xtream API zu verbinden
        result = connect_xtream(base_url, username, password)

        print("✅ Verbindung erfolgreich:", result)
        return result

    except HTTPException:
        raise  # schon korrekt behandelt
    except Exception as e:
        print("❌ FEHLER in /auth/connect-xtream:", e)
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "details": traceback.format_exc()},
        )