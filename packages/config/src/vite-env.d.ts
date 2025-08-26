/// <reference types="vite/client" />

interface ConfigMetaEnv {
    readonly VITE_API_PORT: number;
    readonly VITE_API_HOST?: string;
    readonly API_CORS_ALLOWED_ORIGINS?: string[] | string;

    readonly HOSPEDA_DATABASE_URL: string;

    readonly VITE_LOG_LEVEL?: string;
    readonly VITE_LOG_INCLUDE_TIMESTAMPS?: string;
    readonly VITE_LOG_INCLUDE_LEVEL?: string;
    readonly VITE_LOG_USE_COLORS?: string;
}

interface ImportMetaEnv extends ConfigMetaEnv {}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
