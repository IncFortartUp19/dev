from fastapi import Request
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session

from campus_api.config import Settings


class Base(DeclarativeBase):
    pass


def make_engine(settings: Settings):
    url = settings.prepare_database_url()
    options = {"check_same_thread": False, "timeout": 10} if url.startswith("sqlite") else {}
    engine = create_engine(url, connect_args=options, pool_pre_ping=True)
    if engine.dialect.name == "sqlite":

        @event.listens_for(engine, "connect")
        def sqlite_foreign_keys(connection, _record):
            connection.execute("PRAGMA foreign_keys=ON")

    return engine


def get_db(request: Request):
    with Session(request.app.state.engine, expire_on_commit=False) as db:
        yield db
