import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

export async function updateJobStatus(jobId, status, { result, error } = {}) {
  const sql = `
    UPDATE jobs
    SET status = $2,
        result = COALESCE($3, result),
        error = $4,
        updated_at = now()
    WHERE id = $1
    RETURNING id, status, updated_at
  `;
  const values = [jobId, status, result ? JSON.stringify(result) : null, error ?? null];
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

export async function closeDb() {
  await pool.end();
}
