from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
import requests
from utils.xtream import connect_xtream

# ====================================================
# 🚀 IPTV Backend – Haupt-App
# ====================================================
app = FastAPI(title="IPTV Backend", version="1.1.0")

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
# 🔑 TMDB API Key (öffentlicher Demo-Key)
# ====================================================
TMDB_API_KEY = "1d6f3b5e4b7aefc0291b8fda764fef62"
TMDB_BASE_URL = "https://api.themoviedb.org/3"


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
        raise
    except Exception as e:
        print("❌ FEHLER in /auth/connect-xtream:", e)
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "details": traceback.format_exc()},
        )


# ====================================================
# 🎬 TMDB Trending API – Echte Daten
# ====================================================
@app.get("/home/trending/{playlist}")
def get_trending(playlist: str):
    """
    Liefert echte Trending Movies & Serien von TMDB.
    """
    print(f"📺 Anfrage nach Trending-Inhalten für Playlist: {playlist}")

    try:
        movies_url = f"{TMDB_BASE_URL}/trending/movie/week?api_key={TMDB_API_KEY}&language=de-DE"
        series_url = f"{TMDB_BASE_URL}/trending/tv/week?api_key={TMDB_API_KEY}&language=de-DE"

        movies_response = requests.get(movies_url).json()
        series_response = requests.get(series_url).json()

        # Nur die Top 10 aus beiden Kategorien
        trending_movies = [
            {
                "title": m.get("title"),
                "poster": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get("poster_path") else None,
                "rating": m.get("vote_average"),
                "category": "Movie"
            }
            for m in movies_response.get("results", [])[:10]
        ]

        trending_series = [
            {
                "title": s.get("name"),
                "poster": f"https://image.tmdb.org/t/p/w500{s.get('poster_path')}" if s.get("poster_path") else None,
                "rating": s.get("vote_average"),
                "category": "Series"
            }
            for s in series_response.get("results", [])[:10]
        ]

        combined = trending_movies + trending_series

        return {
            "status": "success",
            "playlist": playlist,
            "source": "TMDB",
            "trending": combined
        }

    except Exception as e:
        print("❌ Fehler beim Abruf der TMDB-Daten:", e)
        return JSONResponse(
            status_code=500,
            content={"error": "Fehler beim Abruf der Trending-Daten", "details": str(e)},
        )