from pgvector.utils import to_db
from app.services.embed import embed_text
from app.lib.db import query, execute

CHUNK_SIZE = 300


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE) -> list[str]:
    words = text.split()
    return [" ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)]


async def ingest_article(article: dict, publisher_id: str) -> dict:
    chunks = chunk_text(article["body_text"])
    batch_size = 5
    vectors = []

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        vectors.extend([embed_text(t) for t in batch])

    db_batch = 100
    for i in range(0, len(chunks), db_batch):
        batch_chunks = chunks[i : i + db_batch]
        batch_vecs = vectors[i : i + db_batch]
        for j, (chunk, vec) in enumerate(zip(batch_chunks, batch_vecs)):
            await execute(
                """INSERT INTO embeddings (doc_id, chunk_idx, corpus_type, text, embedding, publisher_id)
                   VALUES ($1, $2, $3, $4, $5::vector, $6)
                   ON CONFLICT (doc_id, chunk_idx, corpus_type)
                   DO UPDATE SET text = EXCLUDED.text, embedding = EXCLUDED.embedding, publisher_id = EXCLUDED.publisher_id""",
                article["slug"], i + j, "publisher", chunk, to_db(vec), publisher_id,
            )

    return {"chunks_count": len(chunks)}


async def remove_article_embeddings(slug: str, publisher_id: str):
    await execute(
        "DELETE FROM embeddings WHERE doc_id = $1 AND publisher_id = $2",
        slug, publisher_id,
    )
