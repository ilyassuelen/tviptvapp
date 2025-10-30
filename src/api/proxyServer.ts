import axios from "axios";

const PROXY_BASE_URL = "https://bromic-natalie-subhemispherically.ngrok-free.dev/proxy";

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

export async function checkProxyHealth(): Promise<boolean> {
  try {
    const res = await axios.get("https://bromic-natalie-subhemispherically.ngrok-free.dev/health", { timeout: 3000 });
    return res.data?.status === "ok";
  } catch {
    return false;
  }
}