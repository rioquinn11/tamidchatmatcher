import os

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from routes.users import users_bp
from routes.match_introductions import introductions_bp
from routes.match_custom import custom_bp
from routes.user_state import user_state_bp
from routes.leaderboard import leaderboard_bp
from routes.classes import classes_bp

load_dotenv()

app = Flask(__name__)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
CORS(app, origins=allowed_origins, supports_credentials=True)

app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(introductions_bp, url_prefix="/api/matches")
app.register_blueprint(custom_bp, url_prefix="/api/matches")
app.register_blueprint(user_state_bp, url_prefix="/api/user-state")
app.register_blueprint(leaderboard_bp, url_prefix="/api/leaderboard")
app.register_blueprint(classes_bp, url_prefix="/api/classes")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(port=8000, debug=True)
