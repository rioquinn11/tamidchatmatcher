from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import json
from pathlib import Path
import time

from routes.users import users_bp
from routes.match_introductions import introductions_bp
from routes.match_custom import custom_bp
from routes.user_state import user_state_bp
from routes.leaderboard import leaderboard_bp

load_dotenv()

app = Flask(__name__)

CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(introductions_bp, url_prefix="/api/matches")
app.register_blueprint(custom_bp, url_prefix="/api/matches")
app.register_blueprint(user_state_bp, url_prefix="/api/user-state")
app.register_blueprint(leaderboard_bp, url_prefix="/api/leaderboard")

# region agent log
try:
    Path("/Users/rioquinn/Desktop/Coding Projects/tamidchatmatcher/.cursor/debug-be6e68.log").parent.mkdir(parents=True, exist_ok=True)
    with Path("/Users/rioquinn/Desktop/Coding Projects/tamidchatmatcher/.cursor/debug-be6e68.log").open("a", encoding="utf-8") as _f:
        _f.write(
            json.dumps(
                {
                    "sessionId": "be6e68",
                    "runId": "post-fix",
                    "hypothesisId": "H2",
                    "location": "backend/main.py:24",
                    "message": "Registered blueprints snapshot",
                    "data": {
                        "routes": [r.rule for r in app.url_map.iter_rules()],
                    },
                    "timestamp": int(time.time() * 1000),
                }
            )
            + "\n"
        )
except Exception:
    pass
# endregion


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(port=8000, debug=True)
