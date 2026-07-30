import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.lib.db import close_pool
from app.services.rss_poller import start_rss_poller, stop_rss_poller
from app.routes.auth import router as auth_router
from app.routes.publishers import router as publishers_router
from app.routes.articles import router as articles_router
from app.routes.trace import router as trace_router
from app.routes.multi_trace import router as multi_trace_router
from app.routes.traces import router as traces_router
from app.routes.article_check import router as article_check_router
from app.routes.deep_trace import router as deep_trace_router
from app.routes.ingest import router as ingest_router
from app.routes.export import router as export_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_rss_poller()
    yield
    stop_rss_poller()
    await close_pool()


app = FastAPI(title="CoMP Ledger API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(publishers_router)
app.include_router(articles_router)
app.include_router(trace_router)
app.include_router(multi_trace_router)
app.include_router(traces_router)
app.include_router(article_check_router)
app.include_router(deep_trace_router)
app.include_router(ingest_router)
app.include_router(export_router)


@app.get("/api/health")
async def health():
    from app.lib.db import get_pool
    pool = await get_pool()
    await pool.fetchval("SELECT 1")
    return {"status": "ok"}
