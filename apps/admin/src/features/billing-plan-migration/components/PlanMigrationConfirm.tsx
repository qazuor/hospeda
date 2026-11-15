import type { TranslationKey } from '@repo/i18n';
import type { PlanMigrationLaunchResponse, PlanMigrationPreview } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';

/** Confirms the previewed cohort and reports the persisted action 17 result. */
export function PlanMigrationConfirm({
    preview,
    pending,
    result,
    onConfirm
}: {
    readonly preview: PlanMigrationPreview;
    readonly pending: boolean;
    readonly result: PlanMigrationLaunchResponse | null;
    readonly onConfirm: () => void;
}) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-pages.planMigration.${key}` as TranslationKey, values);
    return (
        <div className="space-y-3">
            <Button
                data-testid="plan-migration-confirm"
                type="button"
                disabled={!preview.launchable || pending || result !== null}
                onClick={onConfirm}
            >
                {tr('confirm')}
            </Button>
            {result ? (
                <p
                    data-testid="plan-migration-result"
                    role="status"
                >
                    {tr('result', {
                        id: result.planMigrationId,
                        rows: result.rows.length,
                        excluded: result.excluded.length
                    })}
                </p>
            ) : null}
        </div>
    );
}
