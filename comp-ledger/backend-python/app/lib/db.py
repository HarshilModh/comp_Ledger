import os
import asyncpg
from pgvector.asyncpg import register_vector

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://comp:comp_dev@localhost:5432/comp_ledger")

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, init=_init_conn)
    return _pool


async def _init_conn(conn):
    await register_vector(conn)


async def query(sql: str, *args):
    pool = await get_pool()
    return await pool.fetch(sql, *args)


async def execute(sql: str, *args):
    pool = await get_pool()
    return await pool.execute(sql, *args)


async def fetchrow(sql: str, *args):
    pool = await get_pool()
    return await pool.fetchrow(sql, *args)


async def fetchval(sql: str, *args):
    pool = await get_pool()
    return await pool.fetchval(sql, *args)


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
