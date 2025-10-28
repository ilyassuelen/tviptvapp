import axios from "axios";
import { Platform } from "react-native";
import { getProxiedUrl } from "./proxyServer";
import * as Network from "expo-network";

// 🔧 Automatische lokale IP-Erkennung für iOS-Simulator & Entwicklung
let LOCAL_IP = "localhost";
Network.getIpAddressAsync().then((ip) => {
  if (ip && ip.startsWith("192.168")) {
    LOCAL_IP = ip;
  }
});

// Helper-Funktion: ersetzt localhost → lokale IP
function normalizeUrl(url: string): string {
  if (!url) return "";
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    return url.replace("localhost", LOCAL_IP).replace("127.0.0.1", LOCAL_IP);
  }
  return url;
}

export interface XtreamInfo {
  username: string;
  password: string;
  serverUrl: string;
}

// 🔑 Login-Funktion (liefert Serverdaten)
export async function loginXtream(baseUrl: string, username: string, password: string) {
  const cleanBase = normalizeUrl(baseUrl.replace(/\/player_api\.php.*$/, "").replace(/\/+$/, ""));
  const url = `${cleanBase}/player_api.php?username=${username}&password=${password}`;
  const res = await axios.get(url);

  if (res.data?.user_info?.auth !== 1) throw new Error("Login fehlgeschlagen");

  const fullServerUrl = cleanBase.startsWith("http") ? cleanBase : `http://${res.data.server_info.url}`;

  return {
    username,
    password,
    serverUrl: fullServerUrl.replace(/^https?:\/\//, ""),
  };
}

// 📺 Live-Streams abrufen
export async function getLiveStreams({ serverUrl, username, password }: XtreamInfo) {
  const url = `http://${normalizeUrl(serverUrl)}/player_api.php?username=${username}&password=${password}&action=get_live_streams`;
  const res = await axios.get(url);
  return res.data;
}

// 🎬 Film-Streams abrufen
export async function getMovieStreams({ serverUrl, username, password }: XtreamInfo) {
  const url = `http://${normalizeUrl(serverUrl)}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`;
  const res = await axios.get(url);
  return res.data;
}

// 🎥 Hauptfunktion: gültige Stream-URL bauen
export async function buildStreamUrl(
  { serverUrl, username, password }: XtreamInfo,
  streamId: number,
  streamType?: string
): Promise<string> {
  let typePath = "live";
  if (streamType?.toLowerCase().includes("movie")) typePath = "movie";
  else if (streamType?.toLowerCase().includes("series")) typePath = "series";

  const base = `http://${normalizeUrl(serverUrl)}/${typePath}/${username}/${password}/${streamId}`;

  // 🔁 Priorität: .m3u8 > .ts > .mp4
  const testUrls =
    streamType?.toLowerCase().includes("movie") || streamType?.toLowerCase().includes("series")
      ? [`${base}.m3u8`]
      : [`${base}.m3u8`, `${base}.ts`, `${base}.mp4`];

  for (const url of testUrls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        console.log(`✅ funktionierender Stream gefunden: ${url}`);

        // 🎬 Bevorzuge immer .m3u8 (beste Kompatibilität)
        let finalUrl = url;
        if (url.endsWith(".mp4") || url.endsWith(".ts")) {
          finalUrl = url.replace(/\.mp4$|\.ts$/, ".m3u8");
          console.log(`🎬 Erzwungene .m3u8-Variante: ${finalUrl}`);
        }

        // 📱 iOS → Stream über lokalen Proxy leiten
        if (Platform.OS === "ios") {
          const proxied = await getProxiedUrl(finalUrl);
          if (proxied && proxied.startsWith("http")) {
            console.log(`🔁 iOS-Proxy aktiv: ${proxied}`);
            return proxied;
          } else {
            console.warn("⚠️ Proxy ungültig, verwende Original-URL:", finalUrl);
            return finalUrl;
          }
        }

        return finalUrl;
      }
    } catch (err) {
      console.warn(`❌ Fehler beim Prüfen der URL ${url}:`, err);
      continue;
    }
  }

  // 🚨 Kein Stream funktioniert → Fallback
  console.warn("⚠️ Kein Stream erreichbar, nutze Standard .m3u8");
  const fallback = `${base}.m3u8`;

  if (Platform.OS === "ios") {
    const proxied = await getProxiedUrl(fallback);
    if (proxied && proxied.startsWith("http")) {
      console.log(`🔁 iOS-Proxy aktiv (Fallback): ${proxied}`);
      return proxied;
    } else {
      console.warn("⚠️ Proxy-Fallback ungültig, verwende Original-URL:", fallback);
      return fallback;
    }
  }

  return fallback;
}