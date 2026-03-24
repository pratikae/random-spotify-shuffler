import os
from flask import Flask, send_from_directory
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from spotipy.oauth2 import SpotifyOAuth
from database import init_db, SessionLocal, User, Bundle
from routes import routes
from scheduler import queue_scheduler

load_dotenv()
init_db()

CLIENT_BUILD = os.path.join(os.path.dirname(__file__), "..", "client", "build")

app = Flask(__name__, static_folder=CLIENT_BUILD, static_url_path="/")

from flask_cors import CORS
CORS(app)

app.sp_oauth = SpotifyOAuth(
    scope="user-read-playback-state user-modify-playback-state playlist-read-private user-library-read playlist-modify-public playlist-modify-private user-library-modify",
    client_id=os.getenv("SPOTIPY_CLIENT_ID"),
    client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
    redirect_uri=os.getenv("SPOTIPY_REDIRECT_URI")
)

queue_scheduler.start()

app.register_blueprint(routes)

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    if path and os.path.exists(os.path.join(CLIENT_BUILD, path)):
        return send_from_directory(CLIENT_BUILD, path)
    return send_from_directory(CLIENT_BUILD, "index.html")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8888))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
