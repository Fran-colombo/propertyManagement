from pydantic import BaseModel, Field


class CreateUser(BaseModel):
    name: str = Field(..., max_length=50)
    surname: str = Field(..., max_length=50)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=8, max_length=128)

class LogUser(BaseModel):
    email: str = Field(..., max_length=50)
    password: str = Field(..., min_length=8, max_length=128)

class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    name: str
    surname: str
    email: str
    role: str
    status: int


    class Config:
        orm_mode = True


