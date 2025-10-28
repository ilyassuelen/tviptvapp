from flask import Flask, request, Response, jsonify, stream_with_context
import requests
from urllib.parse import urljoin, quote, urlparse
import urllib3

# 🔇 SSL-Warnungen deaktivieren
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

# ✅ Gemeinsame Session für persistente Cookies & Header
session = requests.Session()
session.headers.update({
    "User-Agent": "ExoPlayerLib/2.15.1 (Linux;Android 11) ExoPlayer/2.15.1",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
})

@app.route("/")
def home():
    return jsonify({"message": "✅ IPTV Proxy aktiv mit dynamischem Referer, Cookie-Handling & Token-Support!"})

@app.route("/proxy", methods=["GET"])
def proxy_request():
    target_url = request.args.get("url")
    if not target_url:
        return jsonify({"error": "❌ missing url"}), 400

    print(f"🔁 Proxy-Anfrage an: {target_url}")

    try:
        parsed = urlparse(target_url)
        base_domain = f"{parsed.scheme}://{parsed.netloc}"

        # Basis-Header
        headers = {
            "Origin": base_domain,
            "Referer": base_domain + "/",
        }

        # 🎬 Wenn es eine M3U8 ist → merken für spätere TS-Segmente
        if target_url.endswith(".m3u8") or "mpegurl" in target_url:
            session.headers["Last-M3U8"] = target_url

        # 📦 TS oder MP4 → richtigen Referer aus Session übernehmen
        if target_url.endswith(".ts") or target_url.endswith(".mp4"):
            headers["Range"] = request.headers.get("Range", "bytes=0-")
            referer_m3u8 = session.headers.get("Last-M3U8", base_domain + "/")
            headers["Referer"] = referer_m3u8
            print(f"📎 TS-Referer gesetzt auf: {referer_m3u8}")

        # 📡 Anfrage mit Session (Cookies bleiben)
        with session.get(target_url, headers=headers, stream=True, timeout=60, verify=False) as r:
            print(f"✅ Antwortstatus vom Zielserver: {r.status_code}")

            # Cookies übernehmen
            session.cookies.update(r.cookies)

            if r.status_code >= 400:
                return Response(r.text, status=r.status_code)

            content_type = r.headers.get("Content-Type", "").lower()
            data = r.content

            # 🎞️ Wenn M3U8 → Rewrite durchführen
            if ".m3u8" in target_url or "mpegurl" in content_type:
                text = data.decode("utf-8", errors="ignore")
                base_url = target_url.rsplit("/", 1)[0] + "/"

                def rewrite_line(line):
                    line = line.strip()
                    if not line or line.startswith("#"):
                        return line
                    abs_url = urljoin(base_url, line)
                    # Segmente über Proxy umleiten
                    return f"http://{request.host}/proxy?url={quote(abs_url, safe='')}"

                rewritten = "\n".join(rewrite_line(l) for l in text.splitlines())
                print("🔧 M3U8 erfolgreich umgeschrieben (mit Segment-Proxy)")

                return Response(
                    rewritten,
                    status=200,
                    content_type="application/vnd.apple.mpegurl",
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "no-cache",
                    },
                )

            # 🔁 TS/MP4 Stream weiterleiten
            resp = Response(
                stream_with_context(r.iter_content(chunk_size=8192)),
                status=r.status_code,
                content_type=content_type or "application/octet-stream",
            )
            resp.headers["Access-Control-Allow-Origin"] = "*"
            resp.headers["Cache-Control"] = "no-cache"
            resp.headers["Accept-Ranges"] = "bytes"
            resp.headers["Connection"] = "keep-alive"
            return resp

    except requests.exceptions.RequestException as e:
        print(f"❌ Proxy-Fehler: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8085)