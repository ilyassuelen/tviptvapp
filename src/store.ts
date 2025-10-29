// 📦 Globaler App-Zustand
type AppState = {
  playlist: string | null;
  connected: boolean;
  xtream?: {
    username: string;
    password: string;
    serverUrl: string;
  } | null;
};

// 🧩 Initialer Zustand
export const appState: AppState = {
  playlist: null,
  connected: false,
  xtream: null,
};

// 🔐 Setzt eine M3U-Playlist-Verbindung
export function setPlaylist(name: string) {
  appState.playlist = name;
  appState.connected = true;
  appState.xtream = null; // Falls vorher Xtream genutzt wurde
  console.log("📺 Playlist verbunden:", name);
}

// 🔑 Setzt eine Xtream-Verbindung
export function setXtreamConnection(username: string, password: string, serverUrl: string) {
  appState.playlist = "Xtream";
  appState.connected = true;
  appState.xtream = { username, password, serverUrl };
  console.log("✅ Xtream verbunden:", appState.xtream);
}

// 🧠 Gibt aktuelle Xtream-Verbindung zurück
export function getXtreamInfo() {
  if (!appState.xtream) {
    console.warn("⚠️ Keine Xtream-Verbindung aktiv!");
    return null;
  }
  return appState.xtream;
}