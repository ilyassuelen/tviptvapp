
import axios from "axios";

// 🧹 Hilfsfunktion: Bereinigt Server-URL (entfernt doppelte Ports und Slashes)
function cleanServerUrl(rawUrl: string): string {
  let url = rawUrl.trim();

  // Entferne doppelte Prefixes
  url = url.replace(/^https?:\/\//i, "");
  url = url.replace(/:\d+$/, ""); // entfernt :80, :443, :8080 usw.
  url = url.replace(/\/+$/, ""); // entfernt trailing slash

  // Baue wieder mit http:// auf (wir testen beide Varianten später)
  return url;
}

export interface XtreamSession {
  username: string;
  password: string;
  serverUrl: string;
  auth: boolean;
  user_info?: any;
  server_info?: any;
}

/**
 * Testet automatisch alle Varianten (http/https) für den Xtream Server
 */
export async function autoDetectXtreamUrl(serverInput: string, username: string, password: string): Promise<XtreamSession> {
  const cleanHost = cleanServerUrl(serverInput);
  const testUrls = [
    `https://${cleanHost}/player_api.php?username=${username}&password=${password}`,
    `https://${cleanHost}/api.php?username=${username}&password=${password}`,
    `http://${cleanHost}/player_api.php?username=${username}&password=${password}`,
    `http://${cleanHost}/api.php?username=${username}&password=${password}`,
  ];

  for (const testUrl of testUrls) {
    console.log("🌍 Teste URL:", testUrl);
    try {
      const response = await axios.get(testUrl, { timeout: 7000 });
      if (response.data?.user_info?.auth === 1) {
        console.log("✅ Erfolgreiche Verbindung:", testUrl);
        // Extrahiere das Basis-URL (ohne Pfad und Query)
        const baseUrl = testUrl.split("/player_api.php")[0].split("/api.php")[0];
        return {
          username,
          password,
          serverUrl: baseUrl,
          auth: true,
          user_info: response.data.user_info,
          server_info: response.data.server_info,
        };
      }
    } catch (err: any) {
      console.log("❌ Verbindung fehlgeschlagen:", testUrl, err.message || err);
    }
  }

  throw new Error("Keine funktionierende Xtream-URL gefunden. Bitte Serverdaten prüfen.");
}

/**
 * Baut den Stream-Link basierend auf Typ auf (Live, Movie, Series)
 */
export async function buildStreamUrl(
  session: XtreamSession,
  stream_id: string | number,
  stream_type: string
): Promise<string> {
  const base = session.serverUrl;
  const { username, password } = session;

  if (stream_type.toLowerCase().includes("live")) {
    return `${base}/live/${username}/${password}/${stream_id}.m3u8`;
  } else if (stream_type.toLowerCase().includes("movie") || stream_type.toLowerCase().includes("vod")) {
    return `${base}/movie/${username}/${password}/${stream_id}.mp4`;
  } else if (stream_type.toLowerCase().includes("series")) {
    return `${base}/series/${username}/${password}/${stream_id}.mp4`;
  } else {
    // fallback
    return `${base}/live/${username}/${password}/${stream_id}.m3u8`;
  }
}