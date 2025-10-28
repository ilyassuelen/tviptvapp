import StaticServer from 'react-native-static-server';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';

let proxy: StaticServer | null = null;
let proxyPort = 8089;

// 🚀 Lokalen Proxy starten, wenn noch nicht aktiv
export async function startProxyServer() {
  if (proxy) return proxy.url;
  const root = FileSystem.cacheDirectory || FileSystem.documentDirectory!;
  proxy = new StaticServer(proxyPort, root, { localOnly: true });
  const url = await proxy.start();
  console.log(`🧩 Lokaler Proxy gestartet: ${url}`);
  return url;
}

// 🔁 Erstellt eine proxied URL für iOS-Kompatibilität
export async function getProxiedUrl(originalUrl: string) {
  const baseUrl = await startProxyServer();
  return `${baseUrl}?url=${encodeURIComponent(originalUrl)}`;
}