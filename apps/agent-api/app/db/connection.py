from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.settings import settings

# Neon uses postgresql:// — convert to asyncpg dialect
db_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://").replace(
    "?sslmode=require", ""
)

engine = create_async_engine(db_url, pool_pre_ping=True, connect_args={"ssl": "require"})
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
