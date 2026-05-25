/**
 * Dynamic llms.txt endpoint (https://llmstxt.org).
 *
 * Serves a concise, link-rich markdown index of the site's primary sections so
 * LLM agents and AI assistants can discover Hospeda's content efficiently. This
 * complements robots.txt (which grants AI crawlers access): robots.txt says
 * "you may crawl", llms.txt says "here is the curated map".
 *
 * Host-aware, mirroring `robots.txt.ts`: on a `HOSPEDA_NOINDEX_HOSTS` host
 * (default `staging.hospeda.com.ar`) it returns only the title with no links,
 * so the staging map is never exposed. Everywhere else it returns the full
 * index with absolute `/es`-prefixed URLs derived from `getSiteUrl()`.
 *
 * Lives as an endpoint (not a static file) for the same reason as robots.txt:
 * the body depends on the requesting host, which a prerendered static file
 * cannot reflect.
 */

import { getNoindexHosts, getSiteUrl } from '@/lib/env';
import { parseNoindexHosts } from '@/lib/middleware-helpers';
import type { APIRoute } from 'astro';

export const prerender = false;

const NOINDEX_HOSTS = parseNoindexHosts(getNoindexHosts());

/** Brand H1 used by both the full and the minimal (noindex) bodies. */
const TITLE = '# Hospeda';

/** One-paragraph blockquote summary describing what Hospeda is. */
const SUMMARY =
    '> Hospeda es la plataforma para descubrir y reservar alojamientos turísticos en el Litoral de Entre Ríos, Argentina: desde cabañas y casas de campo hasta hoteles, con información turística de la región.';

/**
 * The primary sections to surface in the index. `path` is appended to the
 * (trailing-slash-stripped) site URL; `label` and `description` render the
 * markdown link line `- [label](url): description`.
 */
const SECTIONS: ReadonlyArray<{
    readonly path: string;
    readonly label: string;
    readonly description: string;
}> = [
    {
        path: '/es/alojamientos/',
        label: 'Alojamientos',
        description: 'Alojamientos turísticos en el Litoral entrerriano.'
    },
    {
        path: '/es/destinos/',
        label: 'Destinos',
        description: 'Guías de destinos de la región.'
    },
    {
        path: '/es/eventos/',
        label: 'Eventos',
        description: 'Agenda de eventos del Litoral.'
    },
    {
        path: '/es/publicaciones/',
        label: 'Publicaciones',
        description: 'Blog con notas y guías de turismo.'
    },
    {
        path: '/es/nosotros/',
        label: 'Sobre nosotros',
        description: 'Qué es Hospeda.'
    },
    {
        path: '/es/preguntas-frecuentes/',
        label: 'Preguntas frecuentes',
        description: 'FAQ para turistas, anfitriones y colaboradores.'
    },
    {
        path: '/es/contacto/',
        label: 'Contacto',
        description: 'Cómo contactarnos.'
    },
    {
        path: '/es/',
        label: 'Inicio',
        description: 'Página principal.'
    }
] as const;

/**
 * Build the full llms.txt markdown index for indexable hosts.
 *
 * @returns The markdown document with the title, summary, and all section links
 */
function buildFullBody(): string {
    const siteUrl = getSiteUrl().replace(/\/$/, '');
    const linkLines = SECTIONS.map(
        ({ path, label, description }) => `- [${label}](${siteUrl}${path}): ${description}`
    ).join('\n');

    return `${TITLE}\n\n${SUMMARY}\n\n## Secciones principales\n\n${linkLines}\n`;
}

/** Minimal body for noindex hosts: the title only, no section map. */
const NOINDEX_BODY = `${TITLE}\n`;

export const GET: APIRoute = ({ request }) => {
    const host = (request.headers.get('host') ?? '').toLowerCase();
    const isNoindexHost = NOINDEX_HOSTS.includes(host);
    const body = isNoindexHost ? NOINDEX_BODY : buildFullBody();

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            ...(isNoindexHost && { 'X-Robots-Tag': 'noindex, nofollow' })
        }
    });
};
