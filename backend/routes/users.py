import os
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Blueprint, request, jsonify
from jose import JWTError, jwt

users_bp = Blueprint("users", __name__)

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours


# ---------- Helpers ----------

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def require_auth(f):
    """Decorator that validates the Bearer token on protected routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        payload = decode_token(token)
        if payload is None:
            return jsonify({"error": "Invalid or expired token"}), 401

        request.user = payload
        return f(*args, **kwargs)
    return decorated


# ---------- Routes ----------

@users_bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    email = body.get("email", "").strip()
    password = body.get("password", "")

    if not email or not password:
        return jsonify({"detail": "Invalid email or password"}), 401

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if supabase_url and supabase_key:
        from supabase import create_client

        client = create_client(supabase_url, supabase_key)
        try:
            response = client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            user = response.user
            token_data = {"sub": user.id, "email": user.email}
        except Exception:
            return jsonify({"detail": "Invalid email or password"}), 401
    else:
        # Dev fallback — accepts any non-empty credentials
        token_data = {"sub": "dev-user-id", "email": email}

    access_token = create_access_token(token_data)
    return jsonify({"access_token": access_token, "token_type": "bearer"})


@users_bp.get("/me")
@require_auth
def get_me():
    payload = request.user
    email = payload.get("email", "")
    return jsonify({
        "id": payload.get("sub", ""),
        "email": email,
        "name": payload.get("name", email.split("@")[0]),
    })
