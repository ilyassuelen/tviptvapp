import requests

def parse_m3u(url: str):
    """
    Lädt eine M3U-Playlist und wandelt sie in eine strukturierte Liste um.
    """
    response = requests.get(url, timeout=20)
    response.raise_for_status()

    lines = response.text.splitlines()
    channels = []
    current_channel = {}

    for line in lines:
        line = line.strip()
        if line.startswith("#EXTINF:"):
            current_channel = {}
            # Metadaten extrahieren
            parts = line.split(",")
            if len(parts) > 1:
                current_channel["name"] = parts[-1]
            if 'tvg-logo="' in line:
                logo = line.split('tvg-logo="')[1].split('"')[0]
                current_channel["stream_icon"] = logo
            if 'group-title="' in line:
                group = line.split('group-title="')[1].split('"')[0]
                current_channel["category_name"] = group
        elif line and not line.startswith("#"):
            current_channel["stream_url"] = line
            channels.append(current_channel)
    return channels