import en from '@repo/i18n/locales/en/admin-billing.json';
import es from '@repo/i18n/locales/es/admin-billing.json';
import pt from '@repo/i18n/locales/pt/admin-billing.json';
import { PermissionEnum, ProviderWatchAuthorizeInputSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatformSetting } from '@/hooks/use-platform-setting';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import {
    useAuthorizeProviderWatch,
    useProviderWatchAccount,
    useProviderWatchAuthorizationPreview
} from '../hooks';

const COPY_BY_LOCALE = { es, en, pt };

/** Month of an instant on the market clock (`YYYY-MM`), the one the battery compares with. */
function currentMarketMonth(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit'
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    return `${year}-${month}`;
}

/** ARS text for an amount in centavos, for display only. */
function formatArs(minor: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
        minor / 100
    );
}

type FormValues = { month: string; maxChargeMinor: string };
type Translate = (
    key: keyof typeof es.settings.providerWatchAuthorization,
    values?: Readonly<Record<string, string>>
) => string;
type Pending = { month: string; maxChargeMinor: number };

/**
 * The month field and the amount, which is NOT typed: it is the exact sum of the money-moving
 * measurements the API computed, shown read-only for the owner to confirm. Validated with the shared
 * schema on submit.
 */
function AuthorizationForm(props: {
    readonly stored: { readonly month: string; readonly maxChargeMinor: number } | null;
    readonly expectedMinor: number;
    readonly disabled: boolean;
    readonly translate: Translate;
    readonly confirmedAccountId: string;
    readonly onValid: (value: Pending) => void;
    readonly onInvalid: () => void;
}) {
    const { stored, expectedMinor, disabled, translate, confirmedAccountId, onValid, onInvalid } =
        props;
    const form = useForm<FormValues>({
        defaultValues: {
            month: stored?.month ?? currentMarketMonth(),
            maxChargeMinor: String(expectedMinor)
        },
        onSubmit: ({ value }) => {
            const parsed = ProviderWatchAuthorizeInputSchema.safeParse({
                month: value.month.trim(),
                // Never typed: the exact amount the API computed.
                maxChargeMinor: expectedMinor,
                confirmedAccountId
            });
            if (parsed.success) {
                onValid({ month: parsed.data.month, maxChargeMinor: parsed.data.maxChargeMinor });
            } else onInvalid();
        }
    });
    return (
        <form
            className="space-y-3"
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                form.handleSubmit();
            }}
        >
            <form.Field name="month">
                {(field) => (
                    <div className="space-y-1.5">
                        <Label htmlFor="provider-watch-month">{translate('monthLabel')}</Label>
                        <Input
                            id="provider-watch-month"
                            data-testid="provider-watch-month"
                            value={field.state.value}
                            disabled={disabled}
                            onChange={(event) => field.handleChange(event.target.value)}
                            onBlur={field.handleBlur}
                        />
                    </div>
                )}
            </form.Field>
            <form.Field name="maxChargeMinor">
                {(field) => (
                    <div className="space-y-1.5">
                        <Label htmlFor="provider-watch-max-charge">
                            {translate('maxChargeLabel')}
                        </Label>
                        <Input
                            id="provider-watch-max-charge"
                            data-testid="provider-watch-max-charge"
                            inputMode="numeric"
                            value={field.state.value}
                            readOnly
                            disabled={disabled}
                        />
                        <p className="text-muted-foreground text-xs">
                            {translate('maxChargeHint')}
                        </p>
                    </div>
                )}
            </form.Field>
            <Button
                type="submit"
                variant="outline"
                data-testid="provider-watch-save"
                disabled={disabled}
            >
                {translate('save')}
            </Button>
        </form>
    );
}

/**
 * Shows and sets the one-run authorization of the provider watch battery (HOS-1512): the month its
 * production run is allowed in, the amount for the run (EXACTLY the sum of the money-moving
 * measurements, computed by the API and shown for the owner to confirm, never typed), and the
 * provider account the owner CONFIRMS (read by the API, never typed). It shows whether the authorization was consumed and by
 * which run. Writing needs `BILLING_PROVIDER_WATCH_MANAGE`, held only by SUPER_ADMIN.
 */
export function ProviderWatchAuthorizationCard() {
    const { locale } = useTranslations();
    const permissions = useUserPermissions();
    const canWrite = permissions.includes(PermissionEnum.BILLING_PROVIDER_WATCH_MANAGE);
    const query = usePlatformSetting({ key: 'billing.providerWatchAuthorization' });
    const account = useProviderWatchAccount({ enabled: canWrite });
    const preview = useProviderWatchAuthorizationPreview({ enabled: canWrite });
    const mutation = useAuthorizeProviderWatch();
    const [pending, setPending] = useState<Pending | null>(null);
    const [invalid, setInvalid] = useState(false);
    const selectedLocale = locale === 'en' || locale === 'pt' ? locale : 'es';
    const copy = COPY_BY_LOCALE[selectedLocale].settings.providerWatchAuthorization;
    const translate: Translate = (key, values = {}) =>
        Object.entries(values).reduce(
            (text, [name, value]) => text.replaceAll(`{${name}}`, value),
            copy[key]
        );

    const stored = query.data?.row?.value ?? null;
    const month = currentMarketMonth();
    const consumedBy = stored?.consumedByRunId;
    const status =
        stored === null
            ? translate('statusNone')
            : consumedBy
              ? translate('statusConsumed', { runId: consumedBy })
              : stored.month === month
                ? translate('statusActive', { month: stored.month })
                : translate('statusStale', { month: stored.month });
    const usable = stored !== null && !consumedBy && stored.month === month;
    const accountLabel = account.data
        ? translate('accountValue', {
              nickname: account.data.nickname ?? '-',
              id: account.data.id
          })
        : '';
    const storedAccount = stored?.accountId
        ? translate('accountValue', {
              nickname: stored.accountNickname ?? '-',
              id: stored.accountId
          })
        : null;

    return (
        <Card data-testid="provider-watch-authorization-card">
            <CardHeader>
                <CardTitle>{translate('title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">{translate('description')}</p>
                <div className="flex items-center gap-2">
                    <Badge
                        variant={usable ? 'default' : 'destructive'}
                        data-testid="provider-watch-authorization-status"
                    >
                        {status}
                    </Badge>
                </div>
                {stored && (
                    <div
                        className="space-y-1 text-sm"
                        data-testid="provider-watch-authorization-current"
                    >
                        <p>
                            {translate('currentValue', {
                                amount: formatArs(stored.maxChargeMinor),
                                minor: String(stored.maxChargeMinor)
                            })}
                        </p>
                        {storedAccount && (
                            <p>{translate('currentAccount', { account: storedAccount })}</p>
                        )}
                        {stored.consumedAt && (
                            <p data-testid="provider-watch-authorization-consumed">
                                {translate('consumedAt', {
                                    date: new Date(stored.consumedAt).toLocaleString(locale)
                                })}
                            </p>
                        )}
                    </div>
                )}
                <p className="text-muted-foreground text-sm">{translate('hint')}</p>
                {!canWrite && (
                    <p className="text-muted-foreground text-sm">
                        {translate('noWritePermission')}
                    </p>
                )}
                {canWrite && (
                    <div className="space-y-1 text-sm">
                        <p className="font-medium">{translate('accountTitle')}</p>
                        {account.isLoading && <p>{translate('accountLoading')}</p>}
                        {account.isError && (
                            <p
                                className="text-destructive"
                                role="alert"
                                data-testid="provider-watch-account-error"
                            >
                                {translate('accountError')}
                            </p>
                        )}
                        {account.data && <p data-testid="provider-watch-account">{accountLabel}</p>}
                    </div>
                )}
                {canWrite && (
                    <div className="space-y-1 text-sm">
                        <p className="font-medium">{translate('expectedTitle')}</p>
                        {preview.isError && (
                            <p
                                className="text-destructive"
                                role="alert"
                                data-testid="provider-watch-preview-error"
                            >
                                {translate('previewError')}
                            </p>
                        )}
                        {preview.data && preview.data.expectedMaxChargeMinor > 0 && (
                            <p data-testid="provider-watch-expected">
                                {translate('expectedValue', {
                                    amount: formatArs(preview.data.expectedMaxChargeMinor),
                                    minor: String(preview.data.expectedMaxChargeMinor),
                                    count: String(preview.data.measurements.length),
                                    ids: preview.data.measurements
                                        .map((measurement) => measurement.id)
                                        .join(', ')
                                })}
                            </p>
                        )}
                        {preview.data && preview.data.expectedMaxChargeMinor === 0 && (
                            <p
                                className="text-destructive"
                                data-testid="provider-watch-no-money"
                            >
                                {translate('noMoneyCatalog')}
                            </p>
                        )}
                    </div>
                )}
                {invalid && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        {translate('invalidValue')}
                    </p>
                )}
                {mutation.isError && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        {translate('saveError')}
                    </p>
                )}
                {!query.isLoading && (
                    <AuthorizationForm
                        key={preview.data?.expectedMaxChargeMinor ?? 'pending'}
                        stored={stored}
                        expectedMinor={preview.data?.expectedMaxChargeMinor ?? 0}
                        disabled={
                            !canWrite ||
                            !account.data ||
                            !preview.data ||
                            preview.data.expectedMaxChargeMinor === 0 ||
                            mutation.isPending
                        }
                        translate={translate}
                        confirmedAccountId={account.data?.id ?? ''}
                        onValid={(value) => {
                            setInvalid(false);
                            setPending(value);
                        }}
                        onInvalid={() => setInvalid(true)}
                    />
                )}
                <AlertDialog
                    open={pending !== null}
                    onOpenChange={(open) => {
                        if (!open) setPending(null);
                    }}
                >
                    <AlertDialogContent data-testid="provider-watch-confirm">
                        <AlertDialogHeader>
                            <AlertDialogTitle>{translate('confirmTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {pending
                                    ? translate('confirmSave', {
                                          month: pending.month,
                                          account: accountLabel,
                                          amount: formatArs(pending.maxChargeMinor)
                                      })
                                    : ''}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={mutation.isPending || !account.data}
                                onClick={() => {
                                    if (pending && account.data) {
                                        mutation.mutate({
                                            ...pending,
                                            confirmedAccountId: account.data.id
                                        });
                                    }
                                }}
                            >
                                {translate('save')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
