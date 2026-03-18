from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from routes.users import users_bp

load_dotenv()

app = Flask(__name__)

CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

app.register_blueprint(users_bp, url_prefix="/api/users")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(port=8000, debug=True)
