import { z } from 'zod';

export const DbSchema = z.object({
    HOSPEDA_DATABASE_URL: z.string()
});

export const parseDBSchema = (env: ConfigMetaEnv) => {
    return DbSchema.parse({
        HOSPEDA_DATABASE_URL: env.HOSPEDA_DATABASE_URL
    });
};
