export function normalizeBaseUrl(input: string): string {
  let u = input.trim();
  u = u.replace(/\/player_api\.php.*$/, "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) u = "http://" + u;
  const hasPort = /^https?:\/\/[^/]+:\d+/i.test(u);
  if (!hasPort) u += ":8080";
  return u;
}