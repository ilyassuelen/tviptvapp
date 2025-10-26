import axios from "axios";
import { Platform } from "react-native";

// ✅ Automatische Backend-Erkennung
// - Web: nutzt localhost (Browser)
// - Mobile (Expo Go): nutzt deine lokale IP
// - Tunnel (Expo Go via exp.direct): erkennt automatisch die korrekte URL

const LOCAL_IP = "192.168.2.101"; // <- IP deines Macs im WLAN
const API_BASE =
  Platform.OS === "web"
    ? "http://localhost:8000"
    : `http://${LOCAL_IP}:8000`;

console.log("🌐 Verbunden mit Backend:", API_BASE);

// ===============================
// 🔗 API-Endpunkte
// ===============================

// Verbinde M3U-Playlist
export async function connectM3U(m3u_url: string, playlist_name = "M3U") {
  try {
    const response = await axios.post(`${API_BASE}/auth/connect-m3u`, {
      m3u_url,
      playlist_name,
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ Fehler bei connectM3U:", error?.response?.data || error);
    throw error;
  }
}

// Verbinde Xtream-Account
export async function connectXtream(
  base_url: string,
  username: string,
  password: string,
  playlist_name = "Xtream"
) {
  try {
    const response = await axios.post(`${API_BASE}/auth/connect-xtream`, {
      base_url,
      username,
      password,
      playlist_name,
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ Fehler bei connectXtream:", error?.response?.data || error);
    throw error;
  }
}

// Hole "Trending"-Inhalte
export async function fetchTrending(playlist: string) {
  try {
    const { data } = await axios.get(
      `${API_BASE}/home/trending/${encodeURIComponent(playlist)}`
    );
    return data;
  } catch (error: any) {
    console.error("❌ Fehler bei fetchTrending:", error?.response?.data || error);
    throw error;
  }
}

// Suche Inhalte global
export async function searchAll(playlist: string, q: string) {
  try {
    const { data } = await axios.get(
      `${API_BASE}/search/${encodeURIComponent(playlist)}`,
      { params: { q } }
    );
    return data;
  } catch (error: any) {
    console.error("❌ Fehler bei searchAll:", error?.response?.data || error);
    throw error;
  }
}