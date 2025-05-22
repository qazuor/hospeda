import { apiLogger } from '@/utils/logger';
import { createClerkClient } from '@clerk/backend';
import { accommodations, getDb, sql } from '@repo/db';
import { Hono } from 'hono';

export const healthRoutes = new Hono();

// Health check endpoint
healthRoutes.get('/', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

healthRoutes.get('/db', async (c) => {
    try {
        const db = getDb();
        // test simple a la conexión
        await db.execute(sql`SELECT 1`);
        apiLogger.info({ location: 'Health' }, '✅ DB Healthcheck passed');
        return c.json({ success: true, message: 'Database OK' }, 200);
    } catch (error) {
        apiLogger.error(error as Error, 'Health - ❌ DB Healthcheck failed');
        return c.json({ success: false, message: 'Database error', error }, 500);
    }
});

healthRoutes.get('/auth', async (c) => {
    try {
        // test simple a clerk
        const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

        if (!CLERK_SECRET_KEY) {
            apiLogger.error(
                new Error('CLERK_SECRET_KEY not set'),
                'Health - ❌ Clerk Healthcheck failed: CLERK_SECRET_KEY not set'
            );
            return c.json({ success: false, message: 'Clerk secret key not set' }, 500);
        }

        const clerkClient = createClerkClient({
            secretKey: CLERK_SECRET_KEY
        });

        const user = await clerkClient.users.getUserList({ limit: 1 });
        if (user) {
            apiLogger.info({ location: 'Health' }, '✅ Clerk Healthcheck passed');
            return c.json({ success: true, message: 'Auth OK' }, 200);
        }
        // It's better to create a new Error object if 'error' is not defined in this scope
        apiLogger.error(
            new Error('Clerk user list empty or failed'),
            'Health - ❌ Clerk Healthcheck failed'
        );
        return c.json({ success: false, message: 'Auth error' }, 500);
    } catch (error) {
        apiLogger.error(error as Error, 'Health - ❌ Clerk Healthcheck failed');
        return c.json({ success: false, message: 'Auth error', error }, 500);
    }
});

healthRoutes.get('/full', async (c) => {
    const status = {
        db: false,
        clerk: false
    };

    // Check DB
    try {
        const db = getDb();
        await db.select().from(accommodations).limit(1);
        status.db = true;
    } catch (err) {
        apiLogger.error(err as Error, 'Health - ❌ DB failed in health/full');
    }

    // Check Clerk
    try {
        // test simple a clerk
        const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

        if (CLERK_SECRET_KEY) {
            const clerkClient = createClerkClient({
                secretKey: CLERK_SECRET_KEY
            });

            const userList = await clerkClient.users.getUserList({ limit: 1 });
            if (userList && Array.isArray(userList.data) && userList.data.length > 0) {
                status.clerk = true;
            } else {
                apiLogger.error(
                    new Error('Clerk user list empty or failed'),
                    'Health - ❌ Clerk Healthcheck failed in /full'
                );
            }
        } else {
            apiLogger.error(
                new Error('CLERK_SECRET_KEY not set'),
                'Health - ❌ Clerk Healthcheck failed: CLERK_SECRET_KEY not set'
            );
        }
    } catch (error) {
        apiLogger.error(error as Error, 'Health - ❌ Clerk Healthcheck failed in /full');
    }

    const ok = status.db && status.clerk;

    return c.json(
        {
            success: ok,
            status
        },
        ok ? 200 : 500
    );
});
