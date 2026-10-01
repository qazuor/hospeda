/**
 * New paid signups freeze card (billing settings page).
 *
 * Binds the `newPaidSignupsFrozen` billing setting: pausing every NEW
 * self-service paid signup (plan checkout, owner commerce checkout, add-on
 * purchase) without a deploy. Kept in its own file so the settings route stays
 * readable, and imported by path — not through the feature barrel — so tests
 * that mock the barrel's hooks keep rendering the real card.
 */

import { AlertCircleIcon } from '@repo/icons';
import type { JSX } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/hooks/use-translations';

/** Props for {@link NewPaidSignupsFreezeCard}. */
export interface NewPaidSignupsFreezeCardProps {
    /** Current form value of `newPaidSignupsFrozen`. */
    readonly checked: boolean;
    /** Form field change handler. */
    readonly onCheckedChange: (checked: boolean) => void;
}

/**
 * Card with the "pause new paid signups" switch and, while it is on, a
 * warning that new signups are currently refused.
 *
 * @param props.checked - Whether the freeze is (about to be) on.
 * @param props.onCheckedChange - Called with the new value.
 * @returns The card element.
 */
export function NewPaidSignupsFreezeCard({
    checked,
    onCheckedChange
}: NewPaidSignupsFreezeCardProps): JSX.Element {
    const { t } = useTranslations();

    return (
        <Card className={checked ? 'border-warning/50' : undefined}>
            <CardHeader>
                <CardTitle>{t('admin-billing.settings.signupFreeze.title')}</CardTitle>
                <CardDescription>
                    {t('admin-billing.settings.signupFreeze.description')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-6">
                    <div>
                        <Label htmlFor="newPaidSignupsFrozen">
                            {t('admin-billing.settings.signupFreeze.label')}
                        </Label>
                        <p className="text-muted-foreground text-xs">
                            {t('admin-billing.settings.signupFreeze.hint')}
                        </p>
                    </div>
                    <Switch
                        id="newPaidSignupsFrozen"
                        checked={checked}
                        onCheckedChange={onCheckedChange}
                    />
                </div>

                {checked && (
                    <div
                        role="status"
                        className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3"
                        data-testid="signup-freeze-active-warning"
                    >
                        <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <p className="text-foreground text-sm">
                            {t('admin-billing.settings.signupFreeze.activeWarning')}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
