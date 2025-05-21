import { defineMiddleware } from 'astro:middleware';
import { defaultLocale, locales } from '@/i18n/config';

export const onRequest = defineMiddleware(async ({ url, redirect }, next) => {
    const pathname = url.pathname;

    // Skip for static assets
    if (pathname.match(/\.(jpg|jpeg|png|gif|svg|css|js)$/)) {
        return next();
    }

    // Extract locale from URL
    const urlLocale = pathname.split('/')[1];

    // If URL has no locale or invalid locale, redirect appropriately
    if (!urlLocale || !locales.includes(urlLocale)) {
        // For default locale, serve without prefix
        if (urlLocale === defaultLocale) {
            return redirect(pathname.replace(`/${defaultLocale}`, ''));
        }
        return next();
    }

    return next();
});
