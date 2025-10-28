import axios from "axios";

export interface XtreamInfo {
  username: string;
  password: string;
  serverUrl: string;
}

export async function loginXtream(baseUrl: string, username: string, password: string) {
  // 🧠 BaseURL bereinigen (ohne /player_api.php oder trailing slashes)
  const cleanBase = baseUrl.replace(/\/player_api\.php.*$/, "").replace(/\/+$/, "");

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
  const url = `http://${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_live_streams`;
  const res = await axios.get(url);
  return res.data;
}

export async function getMovieStreams({ serverUrl, username, password }: XtreamInfo) {
  const url = `http://${serverUrl}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`;
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

  const base = `http://${serverUrl}/${typePath}/${username}/${password}/${streamId}`;
  const testUrls = [`${base}.m3u8`, `${base}.mp4`, `${base}.ts`];

  for (const url of testUrls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        console.log(`✅ funktionierender Stream gefunden: ${url}`);
        return url;
      }
    } catch (_) {}
  }

  console.warn("⚠️ Kein Stream erreichbar, nutze Standard .m3u8");
  return `${base}.m3u8`;
}