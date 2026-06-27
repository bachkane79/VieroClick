from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.settings import settings

raw_db_url = settings.database_url
parsed_db_url = urlsplit(raw_db_url)
query = dict(parse_qsl(parsed_db_url.query, keep_blank_values=True))
sslmode = query.pop("sslmode", "")
query.pop("channel_binding", None)

# Neon uses postgresql:// - convert to asyncpg dialect and pass SSL through
# asyncpg connect_args instead of libpq-style URL parameters.
clean_db_url = urlunsplit(
    (
        parsed_db_url.scheme,
        parsed_db_url.netloc,
        parsed_db_url.path,
        urlencode(query),
        parsed_db_url.fragment,
    )
)
db_url = clean_db_url.replace("postgresql://", "postgresql+asyncpg://")
connect_args = {"ssl": "require"} if sslmode == "require" else {}

engine = create_async_engine(db_url, pool_pre_ping=True, connect_args=connect_args)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
