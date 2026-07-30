import os
import base64
import json
import time
import bcrypt
import jwt
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel, EmailStr

from app.lib.db import query, execute, fetchrow

router = APIRouter()

JWT_SECRET = os.getenv("JWT_SECRET", "comp-ledger-dev-secret-change-in-prod")
JWT_EXPIRES = 7 * 86400  # 7 days
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


def sign_token(publisher: dict) -> str:
    payload = {
        "id": str(publisher["id"]),
        "email": publisher["email"],
        "role": publisher.get("role", "publisher"),
        "exp": int(time.time()) + JWT_EXPIRES,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None


def get_token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    cookie = request.headers.get("cookie", "")
    for part in cookie.split(";"):
        part = part.strip()
        if part.startswith("token="):
            return part[6:]
    return None


def get_current_user(request: Request) -> dict | None:
    token = get_token(request)
    if not token:
        return None
    return verify_token(token)


def set_token_cookie(response: Response, token: str):
    response.set_cookie("token", token, max_age=JWT_EXPIRES, path="/", httponly=True, samesite="strict")


# ── Models ──────────────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    publication: str
    domain: str
    alt_domains: list[str] = []
    rss_url: str | None = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


class GoogleBody(BaseModel):
    credential: str


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/api/auth/register", status_code=201)
async def register(body: RegisterBody, response: Response):
    existing = await query("SELECT id FROM publishers WHERE email = $1", body.email)
    if existing:
        raise HTTPException(409, "Email already registered")

    domain_check = await query("SELECT id FROM publishers WHERE domain = $1", body.domain.lower())
    if domain_check:
        raise HTTPException(409, "Domain already registered")

    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt(10)).decode()
    row = await fetchrow(
        """INSERT INTO publishers (name, email, password_hash, publication, domain, alt_domains, rss_url, role)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'publisher')
           RETURNING id, name, email, publication, domain, role, created_at""",
        body.name, body.email, pw_hash, body.publication,
        body.domain.lower(), body.alt_domains, body.rss_url,
    )
    publisher = dict(row)
    token = sign_token(publisher)
    set_token_cookie(response, token)
    return {"token": token, "publisher": publisher}


@router.post("/api/auth/login")
async def login(body: LoginBody, response: Response):
    row = await fetchrow(
        "SELECT id, name, email, password_hash, publication, domain, role, status FROM publishers WHERE email = $1",
        body.email,
    )
    if not row:
        raise HTTPException(401, "Invalid email or password")
    publisher = dict(row)
    if publisher["status"] != "active":
        raise HTTPException(403, "Account is suspended")
    if not publisher.get("password_hash"):
        raise HTTPException(401, "No password set. Please contact admin.")
    if not bcrypt.checkpw(body.password.encode(), publisher["password_hash"].encode()):
        raise HTTPException(401, "Invalid email or password")

    token = sign_token(publisher)
    set_token_cookie(response, token)
    return {"token": token, "publisher": {k: publisher[k] for k in ("id", "name", "email", "publication", "domain", "role")}}


@router.get("/api/auth/me")
async def me(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    row = await fetchrow(
        "SELECT id, name, email, publication, domain, role, status, created_at FROM publishers WHERE id = $1",
        user["id"],
    )
    if not row:
        raise HTTPException(401, "User not found")
    return dict(row)


@router.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie("token", path="/")
    return {"success": True}


@router.put("/api/auth/change-password")
async def change_password(body: ChangePasswordBody, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    row = await fetchrow("SELECT password_hash FROM publishers WHERE id = $1", user["id"])
    if not row:
        raise HTTPException(404, "User not found")
    if not bcrypt.checkpw(body.current_password.encode(), row["password_hash"].encode()):
        raise HTTPException(401, "Current password is incorrect")
    new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt(10)).decode()
    await execute("UPDATE publishers SET password_hash = $1, updated_at = now() WHERE id = $2", new_hash, user["id"])
    return {"success": True}


@router.get("/api/auth/google/config")
async def google_config():
    return {"client_id": GOOGLE_CLIENT_ID, "enabled": bool(GOOGLE_CLIENT_ID)}


@router.post("/api/auth/google")
async def google_auth(body: GoogleBody, response: Response):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(501, "Google auth not configured")

    parts = body.credential.split(".")
    if len(parts) != 3:
        raise HTTPException(401, "Invalid Google token format")

    try:
        padding = 4 - len(parts[1]) % 4
        decoded = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * padding))
    except Exception:
        raise HTTPException(401, "Could not decode Google token")

    if decoded.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(401, "Token audience mismatch")
    if decoded.get("exp", 0) < time.time():
        raise HTTPException(401, "Token expired")

    email = decoded.get("email")
    name = decoded.get("name")
    if not email:
        raise HTTPException(400, "Google account has no email")

    row = await fetchrow("SELECT * FROM publishers WHERE email = $1", email)
    if not row:
        domain = email.split("@")[1] if "@" in email else "unknown.com"
        domain_check = await query("SELECT id FROM publishers WHERE domain = $1", domain)
        final_domain = f"{domain}-{int(time.time())}" if domain_check else domain
        row = await fetchrow(
            "INSERT INTO publishers (name, email, publication, domain, role) VALUES ($1, $2, $3, $4, 'publisher') RETURNING *",
            name or email, email, name or email.split("@")[0], final_domain,
        )

    publisher = dict(row)
    if publisher["status"] != "active":
        raise HTTPException(403, "Account is suspended")

    token = sign_token(publisher)
    set_token_cookie(response, token)
    return {"token": token, "publisher": {k: publisher[k] for k in ("id", "name", "email", "publication", "domain", "role")}}
