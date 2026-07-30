from pgvector.utils import to_db
from app.lib.db import query


async def retrieve_candidates(query_vec: list[float], top_k: int = 5, publisher_id: str | None = None):
    vec_str = to_db(query_vec)

    if publisher_id:
        pub_rows = await query(
            """SELECT doc_id, chunk_idx, text, 1 - (embedding <=> $1::vector) AS similarity
               FROM embeddings
               WHERE corpus_type = 'publisher' AND publisher_id = $3
               ORDER BY embedding <=> $1::vector
               LIMIT $2""",
            vec_str, top_k, publisher_id,
        )
    else:
        pub_rows = await query(
            """SELECT doc_id, chunk_idx, text, 1 - (embedding <=> $1::vector) AS similarity
               FROM embeddings
               WHERE corpus_type = 'publisher'
               ORDER BY embedding <=> $1::vector
               LIMIT $2""",
            vec_str, top_k,
        )

    ref_rows = await query(
        """SELECT doc_id, chunk_idx, text, 1 - (embedding <=> $1::vector) AS similarity
           FROM embeddings
           WHERE corpus_type = 'reference'
           ORDER BY embedding <=> $1::vector
           LIMIT $2""",
        vec_str, top_k,
    )

    return {
        "publisher_hits": [dict(r) for r in pub_rows],
        "reference_hits": [dict(r) for r in ref_rows],
    }
