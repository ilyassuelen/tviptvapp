import axios from "axios";

/**
 * IPTV Proxy-Konfiguration
 * Nutzt den lokalen Flask-Server (läuft z. B. auf http://192.168.2.101:8085)
 * um alle Streams umzuleiten → vermeidet CORS- & iOS-Probleme.
 */
const PROXY_BASE_URL = "http://192.168.2.101:8085/proxy";

/**
 * Baut die finale Proxy-URL auf, über die der Stream geladen wird.
 * Beispiel:
 *   Original: http://m3u.best-smarter.me/live/.../1537280.m3u8
 *   Ergebnis: http://192.168.2.101:8085/proxy?url=http%3A%2F%2Fm3u.best-smarter.me%2Flive%2F...%2F1537280.m3u8
 */
export async function getProxiedUrl(originalUrl: string): Promise<string> {
  if (!originalUrl) return "";

  try {
    const encoded = encodeURIComponent(originalUrl);
    const proxiedUrl = `${PROXY_BASE_URL}?url=${encoded}`;
    console.log("🧩 Verwende Flask-Proxy-URL:", proxiedUrl);
    return proxiedUrl;
  } catch (err) {
    console.warn("⚠️ Proxy-URL konnte nicht erstellt werden:", err);
    return originalUrl;
  }
}

/**
 * Optional: Testet, ob der Proxy-Server erreichbar ist.
 */
export async function checkProxyHealth(): Promise<boolean> {
  try {
    const res = await axios.get("http://192.168.2.101:8085/health", { timeout: 3000 });
    return res.data?.status === "ok";
  } catch {
    return false;
  }
}