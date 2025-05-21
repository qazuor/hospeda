/// <reference types="astro/client" />

interface ImportMetaEnv {
    readonly ASTRO_DATABASE_URL: string;
    readonly ASTRO_API_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
