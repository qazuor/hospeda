/**
 * McpActivityCoverageNote (HOS-2349, spec HOS-2335 R-16)
 *
 * "Every use" is not literally every use: rate-limited calls and calls that
 * crash before the tool leave no row. The screen says so in its header.
 */

import { useTranslations } from '@/hooks/use-translations';

/** Renders the coverage note of the assistant activity log. */
export function McpActivityCoverageNote() {
    const { t } = useTranslations();
    return (
        <p
            className="max-w-md text-muted-foreground text-xs"
            data-testid="mcp-activity-coverage-note"
        >
            {t('admin-entities.entities.mcpActivity.coverageNote')}
        </p>
    );
}
