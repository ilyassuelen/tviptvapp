// src/store.ts
export type XtreamInfo = {
  username: string;
  password: string;
  serverUrl: string;
} | null;

let _xtream: XtreamInfo = null;

export function setXtreamConnection(username: string, password: string, serverUrl: string) {
  _xtream = { username, password, serverUrl };
}

export function getXtreamInfo() {
  return _xtream;
}