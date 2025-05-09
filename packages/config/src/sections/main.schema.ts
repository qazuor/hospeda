import { z } from 'zod';

export const MainSchema = z.object({
    API_PORT: z.coerce.number(),
    API_HOST: z.string(),
    API_URL: z.string(),
    API_CORS_ALLOWED_ORIGINS: z.array(z.string())
});

export const parseMainSchema = (env: ConfigMetaEnv) => {
    return MainSchema.parse({
        API_PORT: env.VITE_API_PORT,
        API_HOST: env.VITE_API_HOST,
        API_URL: `${env.VITE_API_HOST}:${env.VITE_API_PORT}/api/v1`,
        API_CORS_ALLOWED_ORIGINS:
            typeof env.API_CORS_ALLOWED_ORIGINS === 'string'
                ? env.API_CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim())
                : env.API_CORS_ALLOWED_ORIGINS
    });
};
