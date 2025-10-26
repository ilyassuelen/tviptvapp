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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================================================
# 🔑 TMDB API Konfiguration
# ====================================================
TMDB_API_KEY = "2c4a1c9246f6cbe59f3d7bce2d7e6c4a"  # funktionierender Key
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
    try:
        data = await request.json()
        base_url = data.get("base_url")
        username = data.get("username")
        password = data.get("password")
        playlist_name = data.get("playlist_name", "Xtream")

        if not all([base_url, username, password]):
            raise HTTPException(status_code=400, detail="Fehlende Parameter: base_url, username oder password fehlen.")

        print(f"📡 Verbindungstest zu {base_url} mit Benutzer: {username}")

        result = connect_xtream(base_url, username, password)
        print("✅ Verbindung erfolgreich:", result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        print("❌ FEHLER in /auth/connect-xtream:", e)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


# ====================================================
# 🎬 TMDB Trending API – mit Genre, Poster & Fallback
# ====================================================
@app.get("/home/trending/{playlist}")
def get_trending(playlist: str):
    print(f"📺 Anfrage nach Trending-Inhalten für Playlist: {playlist}")

    try:
        # ====== Movies abrufen ======
        movies_url = f"{TMDB_BASE_URL}/trending/movie/week"
        series_url = f"{TMDB_BASE_URL}/trending/tv/week"
        params = {"api_key": TMDB_API_KEY, "language": "de-DE"}

        movies_response = requests.get(movies_url, params=params, timeout=10)
        series_response = requests.get(series_url, params=params, timeout=10)

        if movies_response.status_code != 200 or series_response.status_code != 200:
            raise Exception("TMDB API antwortet nicht korrekt")

        movies = movies_response.json().get("results", [])[:20]
        series = series_response.json().get("results", [])[:20]

        # ====== Genre-Liste abrufen ======
        movie_genres = requests.get(f"{TMDB_BASE_URL}/genre/movie/list", params=params).json().get("genres", [])
        tv_genres = requests.get(f"{TMDB_BASE_URL}/genre/tv/list", params=params).json().get("genres", [])
        genre_map = {g["id"]: g["name"] for g in (movie_genres + tv_genres)}

        # ====== Formatieren ======
        trending_movies = [
            {
                "title": m.get("title") or m.get("original_title"),
                "poster": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get("poster_path") else None,
                "genre": genre_map.get(m.get("genre_ids", [None])[0], "Unbekannt"),
                "category": "Movie",
            }
            for m in movies if m.get("poster_path")
        ]

        trending_series = [
            {
                "title": s.get("name") or s.get("original_name"),
                "poster": f"https://image.tmdb.org/t/p/w500{s.get('poster_path')}" if s.get("poster_path") else None,
                "genre": genre_map.get(s.get("genre_ids", [None])[0], "Unbekannt"),
                "category": "Series",
            }
            for s in series if s.get("poster_path")
        ]

        combined = trending_movies + trending_series

        print(f"✅ TMDB liefert {len(combined)} Einträge.")
        return {"status": "success", "playlist": playlist, "source": "TMDB", "trending": combined}

    except Exception as e:
        print("⚠️ Keine Daten von TMDB erhalten – nutze Fallback.")
        print("Fehler:", e)
        # ====== Dummy Fallback ======
        fallback = [
            {"title": "Inception", "poster": "https://image.tmdb.org/t/p/w500/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg", "genre": "Sci-Fi", "category": "Movie"},
            {"title": "Breaking Bad", "poster": "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg", "genre": "Drama", "category": "Series"},
            {"title": "Avatar: The Way of Water", "poster": "https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg", "genre": "Action", "category": "Movie"},
            {"title": "The Last of Us", "poster": "https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg", "genre": "Drama", "category": "Series"},
        ]
        return {"status": "success", "playlist": playlist, "source": "Fallback", "trending": fallback}