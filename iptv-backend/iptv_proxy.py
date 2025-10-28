from flask import Flask, request, Response, jsonify, stream_with_context
import requests
from urllib.parse import urljoin, quote, urlparse
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

session = requests.Session()
session.headers.update({
    "User-Agent": "Lavf/58.76.100",  # ⚡ Simuliert Smarters/TiviMate Player
    "Accept": "*/*",
    "Connection": "keep-alive",
})

last_m3u8 = None
last_cookie = None

@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200


@app.route("/")
def index():
    return jsonify({"message": "✅ IPTV Proxy aktiv mit Anti-403 Schutz"}), 200


@app.route("/proxy")
def proxy_request():
    global last_m3u8, last_cookie
    target_url = request.args.get("url")
    if not target_url:
        return jsonify({"error": "missing url"}), 400

    parsed = urlparse(target_url)
    base_domain = f"{parsed.scheme}://{parsed.netloc}"

    headers = {
        "Origin": base_domain,
        "Referer": base_domain + "/",
        "User-Agent": session.headers["User-Agent"],
        "Accept": "*/*",
        "Connection": "keep-alive",
    }

    if target_url.endswith(".m3u8"):
        last_m3u8 = target_url

    if target_url.endswith(".ts"):
        if last_m3u8:
            headers["Referer"] = last_m3u8
        if "Range" in request.headers:
            headers["Range"] = request.headers["Range"]
        if last_cookie:
            headers["Cookie"] = last_cookie

    try:
        with session.get(target_url, headers=headers, stream=True, timeout=20, verify=False) as r:
            print(f"📡 GET {target_url} → {r.status_code}")

            # Cookie speichern
            if "set-cookie" in r.headers:
                last_cookie = r.headers["set-cookie"]

            # 🔁 Automatisch bei 403 erneut mit anderem Referer versuchen
            if r.status_code == 403 and last_m3u8:
                print("⚠️ 403 erkannt → erneuter Versuch mit korrigiertem Referer...")
                headers["Referer"] = last_m3u8
                with session.get(target_url, headers=headers, stream=True, timeout=20, verify=False) as retry:
                    print(f"🔁 Neuer Versuch → {retry.status_code}")
                    if retry.status_code == 200:
                        r = retry
                    else:
                        return Response(retry.text, status=retry.status_code)

            if r.status_code >= 400:
                return Response(r.text, status=r.status_code)

            content_type = r.headers.get("Content-Type", "")
            data = r.content

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
                return Response(
                    rewritten,
                    status=200,
                    content_type="application/vnd.apple.mpegurl",
                    headers={"Access-Control-Allow-Origin": "*"}
                )

            resp = Response(
                stream_with_context(r.iter_content(chunk_size=8192)),
                status=r.status_code,
                content_type=content_type or "application/octet-stream",
            )
            resp.headers["Access-Control-Allow-Origin"] = "*"
            resp.headers["Accept-Ranges"] = "bytes"
            return resp

    except requests.exceptions.RequestException as e:
        print(f"❌ Proxy-Fehler: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8085)