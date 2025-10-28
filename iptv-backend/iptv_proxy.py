from flask import Flask, request, Response, jsonify, stream_with_context
import requests
from urllib.parse import urljoin, quote, urlparse
import urllib3
import re

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
app = Flask(__name__)

@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200

# 🧠 Gemeinsame Session
session = requests.Session()
session.headers.update({
    "User-Agent": "ExoPlayerLib/2.15.1 (Linux;Android 11) ExoPlayer/2.15.1",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
})

@app.route("/")
def home():
    return jsonify({"message": "✅ IPTV Proxy aktiv mit Token-, Cookie- & Referer-Support!"})

@app.route("/proxy", methods=["GET"])
def proxy_request():
    target_url = request.args.get("url")
    if not target_url:
        return jsonify({"error": "missing url"}), 400

    print(f"🔁 Proxy-Anfrage an: {target_url}")

    try:
        parsed = urlparse(target_url)
        base_domain = f"{parsed.scheme}://{parsed.netloc}"

        headers = {
            "Origin": base_domain,
            "Referer": base_domain + "/",
            "User-Agent": session.headers["User-Agent"],
        }

        # 🔐 Wenn .ts oder .mp4 → dynamischer Referer per Token
        if target_url.endswith(".ts") or target_url.endswith(".mp4"):
            headers["Range"] = request.headers.get("Range", "bytes=0-")

            match = re.search(r"/hls/([a-z0-9]+)/", target_url)
            if match:
                token = match.group(1)
                referer_m3u8 = f"http://m3u.best-smarter.me/hls/{token}/index.m3u8"
                print(f"📎 Token erkannt: {token} → Referer gesetzt auf {referer_m3u8}")
            else:
                referer_m3u8 = session.headers.get("Last-M3U8", base_domain + "/")
                print(f"📎 Kein Token → Standard-Referer: {referer_m3u8}")
            headers["Referer"] = referer_m3u8

        # 📋 M3U8 merken
        if target_url.endswith(".m3u8"):
            session.headers["Last-M3U8"] = target_url

        # 📡 Anfrage
        r = session.get(target_url, headers=headers, stream=True, timeout=60, verify=False)
        print(f"📡 GET {target_url} → {r.status_code}")
        session.cookies.update(r.cookies)

        # ⚠️ 403? → Einmal neu versuchen mit anderem Referer
        if r.status_code == 403 and "/hls/" in target_url:
            print("⚠️ 403 erkannt → erneuter Versuch mit korrigiertem Referer...")
            live_referer = session.headers.get("Last-M3U8", base_domain + "/")
            headers["Referer"] = live_referer
            r = session.get(target_url, headers=headers, stream=True, timeout=60, verify=False)
            print(f"🔁 Neuer Versuch → {r.status_code}")

        if r.status_code >= 400:
            print(f"❌ Fehlerantwort ({r.status_code}) von {target_url}")
            return Response(r.text, status=r.status_code)

        content_type = r.headers.get("Content-Type", "").lower()
        data = r.content

        # 🎬 M3U8 umschreiben
        if ".m3u8" in target_url or "mpegurl" in content_type:
            text = data.decode("utf-8", errors="ignore")
            base_url = target_url.rsplit("/", 1)[0] + "/"

            def rewrite_line(line):
                line = line.strip()
                if not line or line.startswith("#"):
                    return line
                abs_url = urljoin(base_url, line)
                return f"http://{request.host}/proxy?url={quote(abs_url, safe='')}"

            rewritten = "\n".join(rewrite_line(l) for l in text.splitlines())
            print("🔧 M3U8 erfolgreich umgeschrieben (mit Segment-Proxy)")

            resp = Response(rewritten, status=200)
            resp.headers["Content-Type"] = "application/vnd.apple.mpegurl"
            resp.headers["Access-Control-Allow-Origin"] = "*"
            resp.headers["Cache-Control"] = "no-cache"
            return resp

        # 🔁 TS / MP4 Stream weiterleiten
        resp = Response(
            stream_with_context(r.iter_content(chunk_size=8192)),
            status=r.status_code,
            content_type=content_type or "video/mp2t",
        )
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Cache-Control"] = "no-cache"
        resp.headers["Accept-Ranges"] = "bytes"
        resp.headers["Connection"] = "keep-alive"
        resp.headers["Content-Type"] = (
            "video/mp2t" if target_url.endswith(".ts") else content_type or "application/octet-stream"
        )
        return resp

    except Exception as e:
        print(f"❌ Proxy-Fehler: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8085)