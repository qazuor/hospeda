import { z } from 'zod';

export const DbSchema = z.object({
    DATABASE_URL: z.string()
});

export const parseDBSchema = (env: ConfigMetaEnv) => {
    return DbSchema.parse({
        DATABASE_URL: env.DATABASE_URL
    });
};
