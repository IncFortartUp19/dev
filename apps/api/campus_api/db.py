from fastapi import Request
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session

from campus_api.config import Settings


class Base(DeclarativeBase):
    pass


@event.listens_for(Session, "after_begin")
def transaction_actor(session, _transaction, connection):
    if connection.dialect.name == "postgresql":
        connection.execute(
            text("SELECT set_config('app.actor_id', :actor, true)"),
            {"actor": session.info.get("actor_id", "")},
        )


def bind_actor(db: Session, actor_id: str):
    # Only called after OIDC validation and resolution to an internal user.
    db.info["actor_id"] = actor_id
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT set_config('app.actor_id', :actor, true)"), {"actor": actor_id})


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
