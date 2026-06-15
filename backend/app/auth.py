import time
import secrets
from typing import Dict, Tuple
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "adminPekanbaru2026"

ACTIVE_TOKENS: Dict[str, float] = {}
FAILED_LOGINS: Dict[str, Tuple[int, float]] = {}

MAX_ATTEMPTS = 5
LOCK_DURATION = 60 # detik

@router.post("/login")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    if ip in FAILED_LOGINS:
        attempts, lock_until = FAILED_LOGINS[ip]
        if now < lock_until:
            raise HTTPException(429, f"Terlalu banyak percobaan. Coba lagi dalam {int(lock_until - now)} detik.")
        elif now > lock_until and attempts >= MAX_ATTEMPTS:
            FAILED_LOGINS[ip] = (0, 0)
            attempts = 0
            
    if form_data.username == ADMIN_USERNAME and form_data.password == ADMIN_PASSWORD:
        token = secrets.token_hex(32)
        ACTIVE_TOKENS[token] = now + (24 * 3600)
        if ip in FAILED_LOGINS:
            del FAILED_LOGINS[ip]
        return {"access_token": token, "token_type": "bearer"}
        
    attempts = FAILED_LOGINS.get(ip, (0, 0))[0] + 1
    lock_until = now + LOCK_DURATION if attempts >= MAX_ATTEMPTS else 0
    FAILED_LOGINS[ip] = (attempts, lock_until)
    raise HTTPException(401, "Username atau password salah")

def verify_token(token: str = Depends(oauth2_scheme)):
    now = time.time()
    if token not in ACTIVE_TOKENS or ACTIVE_TOKENS[token] < now:
        raise HTTPException(401, "Token tidak valid atau sudah kadaluarsa")
    return True
