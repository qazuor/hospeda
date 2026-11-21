/**
 * @file use-email-previews.ts
 * @description TanStack Query hooks for the admin email previewer (HOS-2519 §6.4).
 *
 * Only `/api/v1/admin/email-previews` is used. Both reads are side-effect free:
 * the API renders fictional sample data and never sends anything.
 */

import type { EmailPreviewListResponse, EmailPreviewRenderResponse } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Admin endpoint of the email catalog. */
export const EMAIL_PREVIEWS_ENDPOINT = '/api/v1/admin/email-previews';

/** Query keys of the email previewer. */
export const emailPreviewQueryKeys = {
    all: ['email-previews'] as const,
    list: () => [...emailPreviewQueryKeys.all, 'list'] as const,
    render: (input: { readonly key: string; readonly scenarioId: string }) =>
        [...emailPreviewQueryKeys.all, 'render', input.key, input.scenarioId] as const
};

/**
 * Builds the render path for one scenario.
 *
 * @param input - Entry key and scenario id.
 * @returns The path with an encoded query string.
 */
export function buildEmailPreviewRenderPath(input: {
    readonly key: string;
    readonly scenarioId: string;
}): string {
    const params = new URLSearchParams({ key: input.key, scenarioId: input.scenarioId });
    return `${EMAIL_PREVIEWS_ENDPOINT}/render?${params.toString()}`;
}

/**
 * Reads the whole catalog summary.
 *
 * @returns The entries in catalog order plus the total.
 */
export async function fetchEmailPreviewList(): Promise<EmailPreviewListResponse> {
    const result = await fetchApi<{ success: boolean; data: EmailPreviewListResponse }>({
        path: EMAIL_PREVIEWS_ENDPOINT
    });
    return result.data.data;
}

/**
 * Renders one scenario of one entry on the server.
 *
 * @param input - Entry key and scenario id.
 * @returns Subject, prefix, HTML and text bodies, and warnings.
 */
export async function fetchEmailPreviewRender(input: {
    readonly key: string;
    readonly scenarioId: string;
}): Promise<EmailPreviewRenderResponse> {
    const result = await fetchApi<{ success: boolean; data: EmailPreviewRenderResponse }>({
        path: buildEmailPreviewRenderPath(input)
    });
    return result.data.data;
}

/**
 * The email catalog list. Static per deploy, so it never goes stale in a session.
 *
 * @returns The TanStack Query result.
 */
export const useEmailPreviewList = () =>
    useQuery({
        queryKey: emailPreviewQueryKeys.list(),
        queryFn: fetchEmailPreviewList,
        staleTime: Number.POSITIVE_INFINITY
    });

/**
 * One rendered scenario. Disabled until both ids are known. The width toggle is
 * not part of the key, so resizing never refetches (AC-7.4).
 *
 * @param input - Entry key and scenario id, `null` while nothing is selected.
 * @returns The TanStack Query result.
 */
export const useEmailPreviewRender = (input: {
    readonly key: string | null;
    readonly scenarioId: string | null;
}) => {
    const { key, scenarioId } = input;
    return useQuery({
        queryKey: emailPreviewQueryKeys.render({ key: key ?? '', scenarioId: scenarioId ?? '' }),
        queryFn: () => fetchEmailPreviewRender({ key: key ?? '', scenarioId: scenarioId ?? '' }),
        enabled: Boolean(key && scenarioId),
        staleTime: Number.POSITIVE_INFINITY,
        retry: false
    });
};
