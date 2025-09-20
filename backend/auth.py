"""
Authentication module for Legal Document Demystifier
Handles user authentication, JWT tokens, and password security
"""

import os
import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Configure logging
logger = logging.getLogger(__name__)

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 24 * 60  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme for FastAPI with required=False for optional auth
security = HTTPBearer(auto_error=False)

# In-memory cache; will persist to GCS or local JSON file
users_db: Dict[str, Dict[str, Any]] = {}

# Persistence configuration
USERS_BUCKET = os.getenv("USERS_BUCKET", "demystifier-ai_cloudbuild")
USERS_PREFIX = os.getenv("USERS_PREFIX", "users")
USERS_LOCAL_FILE = os.getenv("USERS_LOCAL_FILE", os.path.join(os.path.dirname(__file__), "users_db.json"))

try:
    from google.cloud import storage  # type: ignore
    GCS_AVAILABLE = True
except Exception:
    storage = None  # type: ignore
    GCS_AVAILABLE = False

def _dt_to_str(dt: datetime) -> str:
    return dt.isoformat()

def _str_to_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s)
    except Exception:
        # Fallback: now
        return datetime.utcnow()

def _stable_user_id(email: str) -> str:
    # Deterministic UUID based on lowercase email so it remains stable across restarts
    return f"user_{uuid.uuid5(uuid.NAMESPACE_DNS, email.lower())}"

def _get_storage_client():
    if not GCS_AVAILABLE:
        return None
    try:
        return storage.Client()
    except Exception as e:
        logger.warning(f"GCS client unavailable: {e}")
        return None

def _user_blob(client, email: str):
    bucket = client.bucket(USERS_BUCKET)
    key = f"{USERS_PREFIX}/{email.lower()}.json"
    return bucket.blob(key)

def _save_user_gcs(user_data: Dict[str, Any]) -> None:
    client = _get_storage_client()
    if not client:
        return
    try:
        blob = _user_blob(client, user_data["email"])
        serializable = {
            **user_data,
            "created_at": _dt_to_str(user_data["created_at"]) if isinstance(user_data.get("created_at"), datetime) else user_data.get("created_at"),
        }
        blob.upload_from_string(json.dumps(serializable), content_type="application/json")
        logger.info(f"Persisted user to GCS: {user_data['email']}")
    except Exception as e:
        logger.warning(f"Failed to persist user to GCS: {e}")

def _load_user_gcs(email: str) -> Optional[Dict[str, Any]]:
    client = _get_storage_client()
    if not client:
        return None
    try:
        blob = _user_blob(client, email)
        if not blob.exists():
            return None
        data = json.loads(blob.download_as_bytes().decode("utf-8"))
        if isinstance(data.get("created_at"), str):
            data["created_at"] = _str_to_dt(data["created_at"])
        return data
    except Exception as e:
        logger.warning(f"Failed to load user from GCS: {e}")
        return None

def _save_user_local(user_data: Dict[str, Any]) -> None:
    try:
        # Load existing
        store = {}
        if os.path.exists(USERS_LOCAL_FILE):
            try:
                with open(USERS_LOCAL_FILE, "r", encoding="utf-8") as f:
                    store = json.load(f)
            except Exception:
                store = {}
        serializable = {
            **user_data,
            "created_at": _dt_to_str(user_data["created_at"]) if isinstance(user_data.get("created_at"), datetime) else user_data.get("created_at"),
        }
        store[user_data["email"].lower()] = serializable
        with open(USERS_LOCAL_FILE, "w", encoding="utf-8") as f:
            json.dump(store, f)
        logger.info(f"Persisted user locally: {user_data['email']}")
    except Exception as e:
        logger.warning(f"Failed to persist user locally: {e}")

def _load_user_local(email: str) -> Optional[Dict[str, Any]]:
    try:
        if not os.path.exists(USERS_LOCAL_FILE):
            return None
        with open(USERS_LOCAL_FILE, "r", encoding="utf-8") as f:
            store = json.load(f)
        data = store.get(email.lower())
        if not data:
            return None
        if isinstance(data.get("created_at"), str):
            data["created_at"] = _str_to_dt(data["created_at"])
        return data
    except Exception:
        return None


# Pydantic models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    id: str
    created_at: datetime
    is_active: bool = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: User


class TokenData(BaseModel):
    email: Optional[str] = None


# Password utilities
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a hashed password"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password for storing in the database"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[TokenData]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        token_data = TokenData(email=email)
        return token_data
    except JWTError as e:
        logger.error(f"JWT verification error: {e}")
        return None


# User management functions
def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get a user from the database by email"""
    # Check cache first
    user = users_db.get(email)
    if user:
        return user
    # Try persistent stores
    loaded = _load_user_gcs(email) or _load_user_local(email)
    if loaded:
        users_db[email] = loaded
        return loaded
    return None


def create_user(user_create: UserCreate) -> User:
    """Create a new user"""
    if get_user_by_email(user_create.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash the password
    hashed_password = get_password_hash(user_create.password)
    
    # Create user data
    user_data = {
        "id": _stable_user_id(user_create.email),
        "email": user_create.email,
        "full_name": user_create.full_name,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "is_active": True
    }
    
    # Store user in database
    users_db[user_create.email] = user_data
    # Persist to storage
    _save_user_gcs(user_data)
    _save_user_local(user_data)
    
    # Return user without password
    return User(
        id=user_data["id"],
        email=user_data["email"],
        full_name=user_data["full_name"],
        created_at=user_data["created_at"],
        is_active=user_data["is_active"]
    )


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate a user with email and password"""
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get the current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        token_data = verify_token(token)
        if token_data is None or token_data.email is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception
    
    user = get_user_by_email(token_data.email)
    if user is None:
        raise credentials_exception
    
    return User(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        created_at=user["created_at"],
        is_active=user["is_active"]
    )


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active user (helper for endpoints)"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


# Demo users for testing
def initialize_demo_users():
    """Initialize some demo users for testing"""
    demo_users = [
        {
            "email": "demo@example.com",
            "password": "demo123",
            "full_name": "Demo User"
        },
        {
            "email": "admin@clarityLegal.com",
            "password": "admin123",
            "full_name": "Admin User"
        }
    ]
    
    for user_data in demo_users:
        if not get_user_by_email(user_data["email"]):
            try:
                user_create = UserCreate(
                    email=user_data["email"],
                    password=user_data["password"],
                    full_name=user_data["full_name"]
                )
                create_user(user_create)
                logger.info(f"Created demo user: {user_data['email']}")
            except Exception as e:
                logger.error(f"Failed to create demo user {user_data['email']}: {e}")


# Authentication dependencies for FastAPI endpoints
def require_auth(current_user: User = Depends(get_current_active_user)) -> User:
    """Dependency that requires authentication"""
    return current_user


def optional_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[User]:
    """Dependency that allows optional authentication"""
    if not credentials:
        return None
    
    try:
        token_data = verify_token(credentials.credentials)
        if token_data is None or token_data.email is None:
            return None
        
        user = get_user_by_email(token_data.email)
        if user is None:
            return None
        
        return User(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            created_at=user["created_at"],
            is_active=user["is_active"]
        )
    except Exception:
        return None