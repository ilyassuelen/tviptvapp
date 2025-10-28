import * as FileSystem from "expo-file-system";
import * as Network from "expo-network";
import axios from "axios";

// 🔧 Wichtig: Safe Import für CommonJS-Modul
let StaticServer: any;
try {
  StaticServer = require("react-native-static-server").default || require("react-native-static-server");
} catch (e) {
  console.error("⚠️ Modul 'react-native-static-server' konnte nicht geladen werden:", e);
}

let proxy: any = null;
const proxyPort = 8089;
let localIP: string | null = null;

// 🚀 Lokalen Proxy starten
export async function startProxyServer(): Promise<string> {
  try {
    if (!StaticServer) {
      throw new Error("StaticServer-Modul ist null oder undefiniert");
    }

    // 🔍 Lokale IP ermitteln (z. B. 192.168.x.x)
    if (!localIP) {
      const ip = await Network.getIpAddressAsync();
      localIP = ip && ip.startsWith("192.168") ? ip : "localhost";
    }

    // Falls Proxy schon läuft → Basis-URL zurückgeben
    if (proxy) {
      return `http://${localIP}:${proxyPort}`;
    }

    // 📂 Root-Verzeichnis für temporäre Dateien
    const root = FileSystem.cacheDirectory || FileSystem.documentDirectory!;
    proxy = new StaticServer(proxyPort, root, { localOnly: true });

    const startedUrl = await proxy.start();
    console.log(`🧩 Lokaler Proxy gestartet: ${startedUrl}`);

    // iOS-Kompatibilität: "localhost" durch reale IP ersetzen
    const finalUrl = startedUrl.replace("localhost", localIP);
    console.log(`🌐 Proxy erreichbar unter: ${finalUrl}`);
    return finalUrl;
  } catch (err) {
    console.error("❌ Proxy konnte nicht gestartet werden:", err);
    return "";
  }
}

// 🔁 Proxied URL erzeugen
export async function getProxiedUrl(originalUrl: string): Promise<string> {
  try {
    const baseUrl = await startProxyServer();
    if (!baseUrl) {
      console.warn("⚠️ Proxy-BaseURL ungültig, verwende Original-URL");
      return originalUrl;
    }

    const final = `${baseUrl}?url=${encodeURIComponent(originalUrl)}`;
    console.log(`🧩 Proxy-Weiterleitung erzeugt: ${final}`);
    return final;
  } catch (err) {
    console.warn("⚠️ Proxy-Aufruf fehlgeschlagen, nutze Original-URL:", err);
    return originalUrl;
  }
}