import { env } from "$env/dynamic/private";
import pkg from 'pg';

const pool = new pkg.Pool({
    connectionString: env.DATABASE_URL,
});

export const connectToDb = async () => await pool.connect();