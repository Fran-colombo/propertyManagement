from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class CreateUser(BaseModel):
    name: str = Field(..., max_length=50)
    surname: str = Field(..., max_length=50)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["admin", "user"] = "user"

class UpdateUser(BaseModel):
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    role: Optional[Literal["admin", "user"]] = None
    status: Optional[Literal[0, 1]] = None

class LogUser(BaseModel):
    email: str = Field(..., max_length=50)
    password: str = Field(..., min_length=8, max_length=128)

class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    surname: str
    email: str
    role: str
    status: int
