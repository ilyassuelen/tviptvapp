// src/api/config.ts

/**
 * 🌍 Konfiguration für IPTV App
 * - BACKEND_BASE_URL: dein FastAPI Backend (Port 8080 → ngrok)
 * - PROXY_BASE_URL: dein Flask Proxy (Port 8085 → ngrok)
 */

// src/api/config.ts

export const BACKEND_BASE_URL = "https://bromic-natalie-subhemispherically.ngrok-free.dev"; // <-- ngrok für 8080
export const PROXY_BASE_URL = "http://127.0.0.1:8085/proxy"; // <-- lokaler Flask-Proxy

export const buildApiUrl = (endpoint: string): string => {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${BACKEND_BASE_URL}${clean}`;
};