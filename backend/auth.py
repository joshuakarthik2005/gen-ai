"""
Authentication module for Legal Document Demystifier
Handles user authentication, JWT tokens, and password security
"""

import os
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

# In-memory user storage (in production, use a proper database)
users_db: Dict[str, Dict[str, Any]] = {}


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
    return users_db.get(email)


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
        "id": f"user_{len(users_db) + 1}",
        "email": user_create.email,
        "full_name": user_create.full_name,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "is_active": True
    }
    
    # Store user in database
    users_db[user_create.email] = user_data
    
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