/**
 * TrustedEditorToggle (HOS-374 §5.1.2 / OQ-1)
 *
 * Presentational switch for a user's trusted-editor status. The four
 * `TRUSTED_EDITOR_PERMISSIONS` are applied and removed as one atomic server
 * action, so the panel exposes ONE control instead of four `PermissionPicker`
 * entries — "publish but not delete" is a state nobody intends.
 *
 * Owns no server state: the parent card runs the mutation and surfaces toasts,
 * matching how it already handles assign/revoke.
 */

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/hooks/use-translations';

export interface TrustedEditorToggleProps {
    /** Current derived status (`true` iff the user holds the whole bundle). */
    readonly checked: boolean;
    /** Disables the control while the mutation is in flight. */
    readonly isPending: boolean;
    /** Called with the requested state when the operator flips the switch. */
    readonly onToggle: (trusted: boolean) => void;
}

export function TrustedEditorToggle({ checked, isPending, onToggle }: TrustedEditorToggleProps) {
    const { t } = useTranslations();

    return (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="space-y-1">
                <Label
                    htmlFor="trusted-editor"
                    className="font-medium text-sm"
                >
                    {t('admin-pages.access.users.permissions.trustedEditor')}
                </Label>
                <p
                    id="trusted-editor-description"
                    className="text-muted-foreground text-sm"
                >
                    {t('admin-pages.access.users.permissions.trustedEditorDesc')}
                </p>
            </div>
            <Switch
                id="trusted-editor"
                aria-describedby="trusted-editor-description"
                checked={checked}
                disabled={isPending}
                onCheckedChange={onToggle}
            />
        </div>
    );
}
