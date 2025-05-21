import { createClerkClient } from '@clerk/backend';
import { accommodations, getDb, sql } from '@repo/db';
import { error, logger } from '@repo/logger';
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
        logger.info('✅ DB Healthcheck passed', 'Health');
        return c.json({ success: true, message: 'Database OK' }, 200);
    } catch (error) {
        logger.error('❌ DB Healthcheck failed', 'Health', error);
        return c.json({ success: false, message: 'Database error', error }, 500);
    }
});

healthRoutes.get('/auth', async (c) => {
    try {
        // test simple a clerk
        const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

        if (!CLERK_SECRET_KEY) {
            logger.error('❌ Clerk Healthcheck failed: CLERK_SECRET_KEY not set', 'Health');
            return c.json({ success: false, message: 'Clerk secret key not set' }, 500);
        }

        const clerkClient = createClerkClient({
            secretKey: CLERK_SECRET_KEY
        });

        const user = await clerkClient.users.getUserList({ limit: 1 });
        if (user) {
            logger.info('✅ Clerk Healthcheck passed', 'Health');
            return c.json({ success: true, message: 'Auth OK' }, 200);
        }
        logger.error('❌ Clerk Healthcheck failed', 'Health', error);
        return c.json({ success: false, message: 'Auth error', error }, 500);
    } catch (error) {
        logger.error('❌ Clerk Healthcheck failed', 'Health', error);
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
        logger.error('❌ DB failed in health/full', 'Health', err);
    }

    // Check Clerk
    try {
        // test simple a clerk
        const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

        if (!CLERK_SECRET_KEY) {
            logger.error('❌ Clerk Healthcheck failed: CLERK_SECRET_KEY not set', 'Health');
        }

        const clerkClient = createClerkClient({
            secretKey: CLERK_SECRET_KEY
        });

        const user = await clerkClient.users.getUserList({ limit: 1 });
        if (user) {
            status.clerk = !!user;
        }
        logger.error('❌ Clerk Healthcheck failed', 'Health', error);
    } catch (error) {
        logger.error('❌ Clerk Healthcheck failed', 'Health', error);
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
