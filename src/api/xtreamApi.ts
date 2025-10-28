import axios from "axios";
import { Platform } from "react-native";
import { getProxiedUrl } from "./proxyServer";

// 🔧 Automatische lokale IP-Erkennung für iOS-Simulator & Entwicklung
import * as Network from "expo-network";

let LOCAL_IP = "localhost";
Network.getIpAddressAsync().then((ip) => {
  if (ip && ip.startsWith("192.168")) {
    LOCAL_IP = ip;
  }
});

// Helper-Funktion, die Server-URL anpasst
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

export async function loginXtream(baseUrl: string, username: string, password: string) {
  // 🧠 BaseURL bereinigen (ohne /player_api.php oder trailing slashes)
  const cleanBase = normalizeUrl(baseUrl.replace(/\/player_api\.php.*$/, "").replace(/\/+$/, ""));

  const url = `${cleanBase}/player_api.php?username=${username}&password=${password}`;
  const res = await axios.get(url);
  if (res.data?.user_info?.auth !== 1) throw new Error("Login fehlgeschlagen");

  // 🔧 sichere Erkennung des Protokolls
  const fullServerUrl = cleanBase.startsWith("http") ? cleanBase : `http://${res.data.server_info.url}`;

  return {
    username,
    password,
    serverUrl: fullServerUrl.replace(/^https?:\/\//, ""), // Nur Host speichern, ohne http/https
  };
}

export async function getLiveStreams({ serverUrl, username, password }: XtreamInfo) {
  const url = `http://${normalizeUrl(serverUrl)}/player_api.php?username=${username}&password=${password}&action=get_live_streams`;
  const res = await axios.get(url);
  return res.data;
}

export async function getMovieStreams({ serverUrl, username, password }: XtreamInfo) {
  const url = `http://${normalizeUrl(serverUrl)}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`;
  const res = await axios.get(url);
  return res.data;
}

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

        // 🎬 Immer bevorzugt .m3u8 (beste Kompatibilität)
        let finalUrl = url;
        if (url.endsWith(".mp4") || url.endsWith(".ts")) {
          finalUrl = url.replace(/\.mp4$|\.ts$/, ".m3u8");
          console.log(`🎬 Erzwungene .m3u8-Variante: ${finalUrl}`);
        }

        // 🔁 Wenn iOS → leite Stream über lokalen Proxy um
        if (Platform.OS === "ios") {
          const proxied = await getProxiedUrl(finalUrl);
          console.log(`🔁 iOS-Proxy aktiv: ${proxied}`);
          return proxied;
        }

        return finalUrl;
      }
    } catch (_) {
      continue;
    }
  }

  console.warn("⚠️ Kein Stream erreichbar, nutze Standard .m3u8");
  const fallback = `${base}.m3u8`;
  if (Platform.OS === "ios") {
    const proxied = await getProxiedUrl(fallback);
    console.log(`🔁 iOS-Proxy aktiv (Fallback): ${proxied}`);
    return proxied;
  }
  return fallback;
}