from flask import Flask, request, Response, jsonify, stream_with_context
import requests
from urllib.parse import urljoin, quote, urlparse
import urllib3, re
from flask_cors import CORS

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
app = Flask(__name__)
CORS(app)

@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200


# 🌍 Gemeinsame Session
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) ExoPlayerLib/2.15.1",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
})


@app.route("/")
def home():
    return jsonify({"message": "✅ IPTV Proxy aktiv – mit Cookie-, Origin- & Header-Handling!"})


@app.route("/proxy")
def proxy():
    target_url = request.args.get("url")
    if not target_url:
        return jsonify({"error": "missing url"}), 400

    print(f"🔁 Proxy-Anfrage an: {target_url}")
    try:
        parsed = urlparse(target_url)
        base_domain = f"{parsed.scheme}://{parsed.netloc}"

        # 🧠 Standard-Header
        headers = {
            "Origin": base_domain,
            "Referer": base_domain + "/",
            "User-Agent": session.headers["User-Agent"],
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Sec-Fetch-Dest": "video",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site",
            "Connection": "keep-alive",
        }

        # 📄 M3U8 → merken + Cookies speichern
        if target_url.endswith(".m3u8"):
            session.headers["Last-M3U8"] = target_url

        # 🎯 TS/MP4-Dateien → dynamischer Referer & Cookies
        if target_url.endswith(".ts") or target_url.endswith(".mp4"):
            headers["Range"] = request.headers.get("Range", "bytes=0-")

            # Token erkennen
            match = re.search(r"/hls/([a-z0-9]+)/", target_url)
            if match:
                token = match.group(1)
                referer_url = f"{base_domain}/hls/{token}/index.m3u8"
                headers["Referer"] = referer_url
                print(f"📎 Token erkannt: {token} → Referer {referer_url}")
            else:
                headers["Referer"] = session.headers.get("Last-M3U8", base_domain + "/")

            # Cookies aus M3U8 speichern & mitsenden
            if "m3u8_cookies" in session.__dict__:
                headers["Cookie"] = session.__dict__["m3u8_cookies"]

        # 🌍 Anfrage
        r = session.get(target_url, headers=headers, stream=True, timeout=60, verify=False)
        print(f"📡 GET {target_url} → {r.status_code}")

        # 🍪 Cookies sichern, falls M3U8
        if target_url.endswith(".m3u8") and "set-cookie" in r.headers:
            cookie_str = r.headers["set-cookie"]
            session.__dict__["m3u8_cookies"] = cookie_str
            print(f"🍪 Cookies gespeichert: {cookie_str}")

        # 🔁 403-Fallback mit Cookie/Referer-Anpassung
        if r.status_code == 403:
            print("⚠️ 403 erkannt → Neuer Versuch mit korrigiertem Header & Cookie")
            if "set-cookie" in r.headers:
                headers["Cookie"] = r.headers["set-cookie"]
            headers["Referer"] = session.headers.get("Last-M3U8", base_domain + "/")
            r = session.get(target_url, headers=headers, stream=True, timeout=60, verify=False)
            print(f"🔁 Zweiter Versuch → {r.status_code}")

        # ❌ Fehler weiterreichen
        if r.status_code >= 400:
            print(f"❌ Fehlerantwort ({r.status_code}) von {target_url}")
            return Response(r.text, status=r.status_code)

        content_type = r.headers.get("Content-Type", "").lower()
        data = r.content

        # 🎬 M3U8 umschreiben (Segment-Proxy)
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

        # 🔁 TS / MP4 weiterleiten
        resp = Response(
            stream_with_context(r.iter_content(chunk_size=8192)),
            status=r.status_code,
            content_type=content_type or "video/mp2t",
        )
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Cache-Control"] = "no-cache"
        resp.headers["Accept-Ranges"] = "bytes"
        resp.headers["Connection"] = "keep-alive"
        return resp

    except Exception as e:
        print(f"❌ Proxy-Fehler: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8085)