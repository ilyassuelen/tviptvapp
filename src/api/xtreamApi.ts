import axios from "axios";
import { getXtreamInfo } from "../store";

export interface XtreamInfo {
  username: string;
  password: string;
  serverUrl: string; // e.g. "http://m3u.best-smarter.me:8080"
}

function normalizeBaseUrl(input: string): string {
  let u = input.replace(/\/player_api\.php.*$/, "").replace(/\/+$/, "");
  u = u.replace("127.0.0.1", "m3u.best-smarter.me");
  if (!/^https?:\/\//i.test(u)) u = "http://" + u;
  const hasPort = /^https?:\/\/[^/]+:\d+/i.test(u);
  if (!hasPort) u += ":8080";
  return u;
}

async function xtreamGET(base: string, path: string, params?: Record<string, any>) {
  const url = `${base}${path}`;
  console.log("📡 XTREAM GET →", url, params ?? {});
  const res = await axios.get(url, { params, validateStatus: () => true });
  console.log("📡 XTREAM RES ←", res.status);
  if (res.status !== 200) {
    const preview =
      typeof res.data === "string" ? res.data.slice(0, 200) : JSON.stringify(res.data).slice(0, 200);
    throw new Error(`HTTP ${res.status} @ ${url} • Body: ${preview}`);
  }
  return res.data;
}

function ensureValidInfo(info: XtreamInfo) {
  if (!info?.serverUrl) throw new Error("❌ XtreamInfo.serverUrl ist undefined!");
  if (!info?.username || !info?.password) throw new Error("❌ XtreamInfo ist unvollständig!");
}

export async function loginXtream(baseUrl: string, username: string, password: string) {
  if (!baseUrl) throw new Error("❌ Keine Base URL angegeben!");
  const cleanBase = normalizeBaseUrl(baseUrl);
  const data = await xtreamGET(cleanBase, "/player_api.php", { username, password });
  if (data?.user_info?.auth !== 1) throw new Error("Login fehlgeschlagen");
  console.log("✅ Xtream Login erfolgreich:", data.user_info.username);
  return { username, password, serverUrl: cleanBase };
}

export async function getLiveStreams(info?: XtreamInfo) {
  const xtream = info || getXtreamInfo();
  ensureValidInfo(xtream!);
  return xtreamGET(xtream!.serverUrl, "/player_api.php", {
    username: xtream!.username,
    password: xtream!.password,
    action: "get_live_streams",
  });
}

export async function getMovieStreams(info?: XtreamInfo) {
  const xtream = info || getXtreamInfo();
  ensureValidInfo(xtream!);
  return xtreamGET(xtream!.serverUrl, "/player_api.php", {
    username: xtream!.username,
    password: xtream!.password,
    action: "get_vod_streams",
  });
}

export async function getSeriesStreams(info?: XtreamInfo) {
  const xtream = info || getXtreamInfo();
  ensureValidInfo(xtream!);
  return xtreamGET(xtream!.serverUrl, "/player_api.php", {
    username: xtream!.username,
    password: xtream!.password,
    action: "get_series",
  });
}

export async function buildStreamUrl(info: XtreamInfo, streamId: number, streamType?: string): Promise<string> {
  ensureValidInfo(info);
  const base = info.serverUrl.replace(/\/$/, "");

  if (streamType?.toLowerCase().includes("live")) {
    return `${base}/live/${info.username}/${info.password}/${streamId}.m3u8`;
  }

  if (streamType?.toLowerCase().includes("movie") || streamType?.toLowerCase().includes("vod")) {
    return `${base}/movie/${info.username}/${info.password}/${streamId}.mp4`;
  }

  if (streamType?.toLowerCase().includes("series") || streamType?.toLowerCase().includes("episode")) {
    return `${base}/series/${info.username}/${info.password}/${streamId}.mp4`;
  }

  return null as any;
}