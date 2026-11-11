from alembic import context

from campus_api import models  # noqa: F401
from campus_api.config import Settings
from campus_api.db import Base, make_engine

config = context.config
settings = config.attributes.get("settings") or Settings.from_env()

if context.is_offline_mode():
    context.configure(
        url=settings.prepare_database_url(),
        target_metadata=Base.metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = make_engine(settings)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
