import axios from "axios";
import { Platform } from "react-native";

// =========================================
// 🌐 Automatische Backend-Erkennung
// =========================================
const LOCAL_IP = "87.106.10.34"; // 👈 IP deines Strato-Servers
const API_BASE = `http://${LOCAL_IP}:8000`;

console.log("🌍 Verbunden mit Backend:", API_BASE);

// ===================================================
// 🔐 LOGIN / VERBINDUNGEN
// ===================================================

// M3U-Playlist verbinden
export async function connectM3U(m3u_url: string, playlist_name = "M3U") {
  try {
    console.log("📡 Sende M3U-Verbindung...");
    const response = await axios.post(`${API_BASE}/auth/connect-m3u`, {
      m3u_url,
      playlist_name,
    });
    console.log("✅ M3U-Verbindung erfolgreich:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ Fehler bei connectM3U:", error?.response?.data || error);
    throw new Error(
      error?.response?.data?.detail ||
        "Fehler bei M3U-Verbindung – bitte Link prüfen."
    );
  }
}

// Xtream-Account verbinden
export async function connectXtream(
  base_url: string,
  username: string,
  password: string,
  playlist_name = "Xtream"
) {
  try {
    console.log("📡 Sende Xtream-Verbindung...");
    const response = await axios.post(`${API_BASE}/auth/connect-xtream`, {
      base_url,
      username,
      password,
      playlist_name,
    });
    console.log("✅ Xtream-Verbindung erfolgreich:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ Fehler bei connectXtream:", error?.response?.data || error);
    throw new Error(
      error?.response?.data?.detail ||
        "Fehler bei Xtream-Verbindung – bitte Zugangsdaten prüfen."
    );
  }
}

// ===================================================
// 🎬 TMDB Trending (Startseite)
// ===================================================
export async function fetchTrending(playlist: string) {
  try {
    const { data } = await axios.get(
      `${API_BASE}/home/trending/${encodeURIComponent(playlist)}`
    );
    return data;
  } catch (error: any) {
    console.error("❌ Fehler bei fetchTrending:", error?.response?.data || error);
    throw new Error("Fehler beim Laden der Trending-Inhalte");
  }
}

// ===================================================
// 📺 IPTV-Kategorien & Kanäle
// ===================================================
export async function fetchIPTVCategories() {
  try {
    const { data } = await axios.get(`${API_BASE}/iptv/categories`);
    return data;
  } catch (error: any) {
    console.error("❌ Fehler bei fetchIPTVCategories:", error?.response?.data || error);
    throw new Error(
      error?.response?.data?.detail || "Fehler beim Laden der Kategorien"
    );
  }
}

export async function fetchIPTVChannels(category: string) {
  try {
    const { data } = await axios.get(`${API_BASE}/iptv/channels`, {
      params: { category },
    });
    return data;
  } catch (error: any) {
    console.error("❌ Fehler bei fetchIPTVChannels:", error?.response?.data || error);
    throw new Error(
      error?.response?.data?.detail ||
        `Fehler beim Laden der Sender (${category})`
    );
  }
}