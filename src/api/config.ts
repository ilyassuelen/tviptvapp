// src/api/config.ts

export const BACKEND_BASE_URL = "http://m3u.best-smarter.me"; // ohne :8080!

// Optional: eigener Flask-Proxy (nicht genutzt)
export const PROXY_BASE_URL = "";

// Baut vollständige URL
export const buildApiUrl = (endpoint: string): string => {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${BACKEND_BASE_URL}${clean}`;
};