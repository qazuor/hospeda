import type { drizzle } from 'drizzle-orm/node-postgres';

export async function withTransaction<T>(
    db: ReturnType<typeof drizzle>,
    callback: (tx: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
    // TODO: This implementation needs to be updated to work with the current db client
    // For now, just call the callback directly
    return await callback(db);
}
