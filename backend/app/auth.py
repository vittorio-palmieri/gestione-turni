from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext

pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def hash_password(p: str) -> str:
    return pwd.hash(p)

def verify_password(p: str, h: str) -> bool:
    return pwd.verify(p, h)

def create_access_token(*, subject: str, secret: str, expires_minutes: int) -> str:
    exp = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload = {"sub": subject, "exp": exp}
    return jwt.encode(payload, secret, algorithm="HS256")
