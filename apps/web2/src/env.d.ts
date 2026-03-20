/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        /** The validated locale for the current request. */
        locale: 'es' | 'en' | 'pt';
    }
}
