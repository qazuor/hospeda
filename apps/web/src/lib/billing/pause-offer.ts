import { SelfSubscriptionPausePreviewResponseSchema } from '@repo/schemas';
import type { z } from 'zod';
import type { ApiResult } from '@/lib/api/types';
import { formatSelfCancelDate } from '@/lib/billing/self-cancel';
import type { SupportedLocale } from '@/lib/i18n';

/** Validated owner pause preview; invalid reads fail closed. */
export function parsePausePreview(
    result: ApiResult<unknown>
): z.infer<typeof SelfSubscriptionPausePreviewResponseSchema> | null {
    if (!result.ok) return null;
    const parsed = SelfSubscriptionPausePreviewResponseSchema.safeParse(result.data);
    return parsed.success ? parsed.data : null;
}

/** Local date for a pause or resume instant. */
export function pauseDate(iso: string, locale: SupportedLocale): string {
    return formatSelfCancelDate({ iso, locale }) ?? '';
}
