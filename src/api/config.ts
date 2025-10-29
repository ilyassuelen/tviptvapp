// src/api/config.ts

/**
 * 🌍 Konfiguration für IPTV App
 * - BACKEND_BASE_URL: dein FastAPI Backend (Port 8080 → ngrok)
 * - PROXY_BASE_URL: dein Flask Proxy (Port 8085 → ngrok)
 */

export const BACKEND_BASE_URL = "https://bromic-natalie-subhemispherically.ngrok-free.dev";
export const PROXY_BASE_URL = "https://bromic-natalie-subhemispherically.ngrok-free.dev/proxy";

/**
 * Hilfsfunktion für API-Aufrufe (z. B. axios)
 */
export const buildApiUrl = (endpoint: string): string => {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${BACKEND_BASE_URL}${clean}`;
};