import axios from "axios";
import { getProxiedUrl } from "./proxyServer";

// 🌍 HTTPS-Proxy via ngrok – iOS sichert nur HTTPS!
const PROXY_BASE = "https://bromic-natalie-subhemispherically.ngrok-free.dev";

// 🧩 Helper: Baut URL für Proxy-Route zusammen
function proxiedApiUrl(target: string): string {
  const encoded = encodeURIComponent(target);
  return `${PROXY_BASE}/proxy?url=${encoded}`;
}

export interface XtreamInfo {
  username: string;
  password: string;
  serverUrl: string;
}

// 🔑 Login
export async function loginXtream(baseUrl: string, username: string, password: string) {
  const cleanBase = baseUrl.replace(/\/player_api\.php.*$/, "").replace(/\/+$/, "");
  const url = `${cleanBase}/player_api.php?username=${username}&password=${password}`;
  const apiUrl = proxiedApiUrl(url);

  const res = await axios.get(apiUrl);

  if (res.data?.user_info?.auth !== 1) throw new Error("Login fehlgeschlagen");

  return {
    username,
    password,
    serverUrl: cleanBase,
  };
}

// 📺 Live-Streams
export async function getLiveStreams({ serverUrl, username, password }: XtreamInfo) {
  const url = `${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_live_streams`;
  const apiUrl = proxiedApiUrl(url);
  const res = await axios.get(apiUrl);
  return res.data;
}

// 🎬 Filme
export async function getMovieStreams({ serverUrl, username, password }: XtreamInfo) {
  const url = `${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`;
  const apiUrl = proxiedApiUrl(url);
  const res = await axios.get(apiUrl);
  return res.data;
}

// 🎞️ Serien
export async function getSeriesStreams({ serverUrl, username, password }: XtreamInfo) {
  const url = `${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_series`;
  const apiUrl = proxiedApiUrl(url);
  const res = await axios.get(apiUrl);
  return res.data;
}

// 🎥 Stream-URL über Proxy holen
export async function buildStreamUrl(
  { serverUrl, username, password }: XtreamInfo,
  streamId: number,
  streamType?: string
): Promise<string> {
  let typePath = "live";
  if (streamType?.toLowerCase().includes("movie")) typePath = "movie";
  else if (streamType?.toLowerCase().includes("series")) typePath = "series";

  const targetUrl = `${serverUrl}/${typePath}/${username}/${password}/${streamId}.m3u8`;
  const proxied = await getProxiedUrl(targetUrl);

  if (proxied && proxied.startsWith("http")) {
    console.log(`🎯 Stream wird über Proxy geladen: ${proxied}`);
    return proxied;
  } else {
    console.warn("⚠️ Proxy ungültig, verwende Original-URL:", targetUrl);
    return targetUrl;
  }
}