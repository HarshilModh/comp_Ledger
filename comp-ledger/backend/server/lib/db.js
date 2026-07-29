import pg from 'pg';
import pgvector from 'pgvector/pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://comp:comp_dev@localhost:5432/comp_ledger',
});

let registered = false;

pool.on('connect', async (client) => {
  if (!registered) {
    await pgvector.registerTypes(client);
    registered = true;
  }
});

export { pool };

export async function query(text, params) {
  return pool.query(text, params);
}
