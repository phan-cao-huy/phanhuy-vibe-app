import time
import urllib.request
import xml.etree.ElementTree as ET
# pyrefly: ignore [missing-import]
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache to prevent spamming Google's RSS feed
feed_cache = {
    "data": None,
    "timestamp": 0
}
CACHE_DURATION = 300  # 5 minutes in seconds

def fetch_and_parse_feed():
    req = urllib.request.Request(
        FEED_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        xml_data = response.read()
        
    root = ET.fromstring(xml_data)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    entries = []
    for entry in root.findall("atom:entry", ns):
        title = entry.find("atom:title", ns)
        entry_id = entry.find("atom:id", ns)
        updated = entry.find("atom:updated", ns)
        link = entry.find("atom:link", ns)
        content = entry.find("atom:content", ns)
        
        link_href = ""
        if link is not None:
            link_href = link.attrib.get("href", "")
            
        entries.append({
            "title": title.text if title is not None else "",
            "id": entry_id.text if entry_id is not None else "",
            "updated": updated.text if updated is not None else "",
            "link": link_href,
            "content": content.text if content is not None else ""
        })
        
    return entries

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/notes")
def get_notes():
    force_refresh = request.args.get("force", "false").lower() == "true"
    current_time = time.time()
    
    # Check cache first unless force_refresh is requested
    if not force_refresh and feed_cache["data"] is not None:
        if current_time - feed_cache["timestamp"] < CACHE_DURATION:
            return jsonify({
                "success": True,
                "source": "cache",
                "entries": feed_cache["data"]
            })
            
    try:
        entries = fetch_and_parse_feed()
        feed_cache["data"] = entries
        feed_cache["timestamp"] = current_time
        return jsonify({
            "success": True,
            "source": "network",
            "entries": entries
        })
    except Exception as e:
        # If network fails but we have cached data, return cached data as a fallback
        if feed_cache["data"] is not None:
            return jsonify({
                "success": True,
                "source": "cache_fallback",
                "entries": feed_cache["data"],
                "warning": f"Could not refresh feed: {str(e)}"
            })
            
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
