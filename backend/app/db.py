from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

class Base(DeclarativeBase):
    pass

def make_engine(database_url: str):
    return create_engine(database_url, pool_pre_ping=True)

def make_session_local(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)
