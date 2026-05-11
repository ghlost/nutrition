from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from database import get_session
from models import User
from auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest, session: Session = Depends(get_session)):
    # Check email not taken
    existing_email = session.exec(select(User).where(User.email == body.email)).first()
    if existing_email:
        raise HTTPException(400, "Email already registered")

    # Check username not taken
    existing_username = session.exec(select(User).where(User.username == body.username)).first()
    if existing_username:
        raise HTTPException(400, "Username already taken")

    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token({"sub": user.id})
    return AuthResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "username": user.username}
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    token = create_access_token({"sub": user.id})
    return AuthResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "username": user.username}
    )


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id":       current_user.id,
        "email":    current_user.email,
        "username": current_user.username,
    }


@router.post("/logout")
def logout():
    # JWT is stateless — client just deletes the token
    return {"message": "Logged out"}