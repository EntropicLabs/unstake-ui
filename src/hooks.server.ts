import { connectToDb } from '$lib/db';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const db = await connectToDb();
    event.locals.db = db;

    const response = await resolve(event);
    db.release();

    return response;
};