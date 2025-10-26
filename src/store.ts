type AppState = {
  playlist: string | null;
  connected: boolean;
};

export const appState: AppState = {
  playlist: null,
  connected: false,
};

export function setPlaylist(name: string) {
  appState.playlist = name;
  appState.connected = true;
}