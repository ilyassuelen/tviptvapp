from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
import requests
from utils.xtream import connect_xtream

# ====================================================
# 🚀 IPTV Backend – Haupt-App
# ====================================================
app = FastAPI(title="IPTV Backend", version="1.2.0")

# ====================================================
# 🌍 CORS aktivieren (Kommunikation mit Expo App)
# ====================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # später einschränken auf deine App-URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================================================
# 🔑 TMDB API (stabiler öffentlicher Key via Bearer-Auth)
# ====================================================
TMDB_API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3ZjQ3ZTc3OTUxM2I0ZjRlMzkxMzg4N2U0NGI2YzdlNCIsInN1YiI6IjY0YzNiZTljMzMzYzQxMDE5ZmI0YTRiYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.xeL06Gkbplg1-ZExv3zK_tMFxDMhy6W0KxSlO_KXkgE"
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

        if not all([base_url, username, password]):
            raise HTTPException(status_code=400, detail="Fehlende Parameter: base_url, username oder password fehlen.")

        print(f"📡 Verbindungstest zu {base_url} mit Benutzer: {username}")

        # Verbindung testen
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
# 🎬 TMDB Trending API – Echte Daten mit Fallback
# ====================================================
@app.get("/home/trending/{playlist}")
def get_trending(playlist: str):
    """
    Liefert echte Trending Movies & Serien von TMDB.
    """
    print(f"📺 Anfrage nach Trending-Inhalten für Playlist: {playlist}")

    headers = {
        "accept": "application/json",
        "Authorization": f"Bearer {TMDB_API_KEY}"
    }

    try:
        movies_url = f"{TMDB_BASE_URL}/trending/movie/week?language=de-DE"
        series_url = f"{TMDB_BASE_URL}/trending/tv/week?language=de-DE"

        movies_response = requests.get(movies_url, headers=headers, timeout=10).json()
        series_response = requests.get(series_url, headers=headers, timeout=10).json()

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

        # Fallback, falls TMDB leer antwortet
        if not combined:
            print("⚠️ Keine Daten von TMDB erhalten – nutze Fallback.")
            combined = [
                {"title": "Oppenheimer", "poster": None, "rating": 8.5, "category": "Movie"},
                {"title": "Dune: Part Two", "poster": None, "rating": 8.3, "category": "Movie"},
                {"title": "Breaking Bad", "poster": None, "rating": 9.5, "category": "Series"},
                {"title": "Game of Thrones", "poster": None, "rating": 9.3, "category": "Series"},
            ]

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
            content={
                "error": "Fehler beim Abruf der Trending-Daten",
                "details": str(e),
            },
        )