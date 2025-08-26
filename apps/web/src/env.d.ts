/// <reference types="astro/client" />

interface ImportMetaEnv {
    // Database (server-side only)
    readonly HOSPEDA_DATABASE_URL: string;

    // API Configuration (exposed by @repo/config plugin)
    readonly PUBLIC_API_URL: string;

    // Authentication (exposed by @repo/config plugin)
    readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
    readonly CLERK_SECRET_KEY: string;

    // Site Configuration (exposed by @repo/config plugin)
    readonly PUBLIC_SITE_URL: string;
    readonly PUBLIC_DEFAULT_LOCALE: string;
    readonly PUBLIC_SUPPORTED_LOCALES: string;

    // Monitoring (optional)
    readonly PUBLIC_SENTRY_DSN?: string;
    readonly SENTRY_ENVIRONMENT?: string;
    readonly SENTRY_RELEASE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
