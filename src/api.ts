import axios from "axios";
import { Platform } from "react-native";

const API_BASE =
  Platform.OS === "web"
    ? "http://localhost:8000"
    : "http://192.168.2.101:8000";

export async function connectM3U(m3u_url: string, playlist_name = "M3U") {
  return axios.post(`${API_BASE}/auth/connect-m3u`, { m3u_url, playlist_name });
}

export async function connectXtream(base_url: string, username: string, password: string, playlist_name = "Xtream") {
  return axios.post(`${API_BASE}/auth/connect-xtream`, { base_url, username, password, playlist_name });
}

export async function fetchTrending(playlist: string) {
  const { data } = await axios.get(`${API_BASE}/home/trending/${encodeURIComponent(playlist)}`);
  return data;
}

export async function searchAll(playlist: string, q: string) {
  const { data } = await axios.get(`${API_BASE}/search/${encodeURIComponent(playlist)}`, { params: { q } });
  return data;
}