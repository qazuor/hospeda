import {
    type PermanentGrantAnchorBody,
    PermanentGrantAnchorBodySchema,
    type PermanentGrantAnchorResponse,
    type PermanentGrantCreateRequest,
    PermanentGrantCreateRequestSchema,
    type PermanentGrantCreateResponse,
    type PermanentGrantRevocationResponse
} from '@repo/schemas';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import {
    useLivePermanentGrant,
    usePermanentGrant,
    usePermanentGrantAnchor,
    usePermanentGrantAnchorPreview,
    usePermanentGrantPreview,
    usePermanentGrantRevocationPreview
} from '../hooks/usePermanentGrants';
import { AnchorForm } from './AnchorForm';
import { GrantForm } from './GrantForm';
import { GrantRefusal } from './GrantRefusal';
import { PermanentGrantConfirmation } from './PermanentGrantConfirmation';
import {
    PermanentGrantRevocationConfirmation,
    PermanentGrantRevocationResult
} from './PermanentGrantRevocationConfirmation';

type Action = 'grant' | 'anchor' | 'revoke' | null;
type Result =
    | { kind: 'grant'; value: PermanentGrantCreateResponse }
    | { kind: 'anchor'; value: PermanentGrantAnchorResponse }
    | { kind: 'revoke'; value: PermanentGrantRevocationResponse };

export function PermanentGrantsScreen({
    initialUserId,
    onSearch
}: {
    initialUserId?: string;
    onSearch: (userId: string) => void;
}) {
    const { t } = useTranslations();
    const [input, setInput] = useState(initialUserId ?? '');
    const [invalid, setInvalid] = useState(false);
    const [action, setAction] = useState<Action>(null);
    const [grantBody, setGrantBody] = useState<PermanentGrantCreateRequest | null>(null);
    const [anchorBody, setAnchorBody] = useState<PermanentGrantAnchorBody | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [actError, setActError] = useState<unknown>(null);
    const userId = initialUserId ?? '';
    const validId = z.uuid().safeParse(userId).success;
    const live = useLivePermanentGrant({ userId, enabled: validId });
    const grantPreview = usePermanentGrantPreview({ body: grantBody, enabled: action === 'grant' });
    const anchorPreview = usePermanentGrantAnchorPreview({
        permanentGrantId: live.data?.grant?.permanentGrantId ?? '',
        body: anchorBody,
        enabled: action === 'anchor'
    });
    const revocationPreview = usePermanentGrantRevocationPreview({
        permanentGrantId: live.data?.grant?.permanentGrantId ?? '',
        enabled: action === 'revoke'
    });
    const grant = usePermanentGrant();
    const anchor = usePermanentGrantAnchor();
    const clear = () => {
        setAction(null);
        setGrantBody(null);
        setAnchorBody(null);
        setActError(null);
    };
    const select = (next: Action) => {
        clear();
        setResult(null);
        setAction(next);
    };
    const search = (event: React.FormEvent) => {
        event.preventDefault();
        setInvalid(false);
        clear();
        setResult(null);
        const parsed = z.uuid().safeParse(input.trim());
        if (!parsed.success) {
            setInvalid(true);
            return;
        }
        onSearch(parsed.data);
    };
    const submit = async () => {
        setActError(null);
        try {
            if (action === 'grant' && grantBody && grantPreview.data) {
                const body = PermanentGrantCreateRequestSchema.parse(grantBody);
                const value = await grant.mutateAsync(body);
                setResult({ kind: 'grant', value });
                clear();
            } else if (
                action === 'anchor' &&
                anchorBody &&
                anchorPreview.data &&
                live.data?.grant
            ) {
                const body = PermanentGrantAnchorBodySchema.parse(anchorBody);
                const value = await anchor.mutateAsync({
                    permanentGrantId: live.data.grant.permanentGrantId,
                    userId,
                    body
                });
                setResult({ kind: 'anchor', value });
                clear();
            }
        } catch (error) {
            setActError(error);
        }
    };
    const currentPreview = action === 'grant' ? grantPreview : anchorPreview;
    return (
        <Card data-testid="permanent-grants-screen">
            <CardContent className="space-y-5 pt-6">
                <form
                    onSubmit={search}
                    className="flex items-end gap-2"
                >
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="beneficiary-id">
                            {t('admin-billing.permanentGrants.beneficiary')}
                        </Label>
                        <Input
                            id="beneficiary-id"
                            value={input}
                            onChange={(event) => {
                                setInput(event.target.value);
                                setInvalid(false);
                            }}
                            data-testid="permanent-grant-beneficiary-id"
                        />
                    </div>
                    <Button
                        type="submit"
                        data-testid="permanent-grant-search"
                    >
                        {t('admin-billing.permanentGrants.search')}
                    </Button>
                </form>
                {invalid ? (
                    <p role="alert">{t('admin-billing.permanentGrants.invalidUserId')}</p>
                ) : null}
                {validId && live.isLoading ? (
                    <p>{t('admin-billing.permanentGrants.loading')}</p>
                ) : null}
                {live.error ? <GrantRefusal error={live.error} /> : null}
                {live.data ? (
                    <section
                        data-testid="permanent-grant-live"
                        className="space-y-3"
                    >
                        {live.data.grant ? (
                            <>
                                <h2 className="font-semibold">
                                    {t('admin-billing.permanentGrants.liveGrant')}
                                </h2>
                                <p>{live.data.grant.permanentGrantId}</p>
                                <ul>
                                    {live.data.grant.anchors.map((row) => (
                                        <li key={row.vertical}>
                                            {t(
                                                `admin-billing.permanentGrants.verticals.${row.vertical}` as 'admin-billing.permanentGrants.verticals.accommodation'
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        onClick={() => select('anchor')}
                                        data-testid="permanent-grant-anchor-action"
                                    >
                                        {t('admin-billing.permanentGrants.anchor')}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={() => select('revoke')}
                                        data-testid="permanent-grant-revoke-action"
                                    >
                                        {t('admin-billing.permanentGrants.revoke')}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p>{t('admin-billing.permanentGrants.noGrant')}</p>
                                <Button
                                    type="button"
                                    onClick={() => select('grant')}
                                    data-testid="permanent-grant-grant-action"
                                >
                                    {t('admin-billing.permanentGrants.grant')}
                                </Button>
                            </>
                        )}
                    </section>
                ) : null}
                {action === 'grant' && !grantBody ? (
                    <GrantForm
                        userId={userId}
                        mode="grant"
                        onPreview={(body) => setGrantBody(body as PermanentGrantCreateRequest)}
                    />
                ) : null}
                {action === 'anchor' && !anchorBody ? (
                    <AnchorForm
                        userId={userId}
                        onPreview={setAnchorBody}
                    />
                ) : null}
                {(action === 'grant' || action === 'anchor') && (grantBody || anchorBody) ? (
                    <>
                        {currentPreview.isLoading || currentPreview.isFetching ? (
                            <p data-testid="permanent-grant-preview-loading">
                                {t('admin-billing.permanentGrants.loading')}
                            </p>
                        ) : null}
                        {currentPreview.error ? (
                            <GrantRefusal error={currentPreview.error} />
                        ) : null}
                        {currentPreview.data && !currentPreview.isFetching ? (
                            <PermanentGrantConfirmation
                                preview={currentPreview.data}
                                action={action}
                                pending={grant.isPending || anchor.isPending}
                                onConfirm={submit}
                                onBack={clear}
                            />
                        ) : null}
                    </>
                ) : null}
                {action === 'revoke' ? (
                    <>
                        {revocationPreview.isLoading || revocationPreview.isFetching ? (
                            <p>{t('admin-billing.permanentGrants.loading')}</p>
                        ) : null}
                        {revocationPreview.error ? (
                            <GrantRefusal error={revocationPreview.error} />
                        ) : null}
                        {revocationPreview.data && !revocationPreview.isFetching ? (
                            <PermanentGrantRevocationConfirmation
                                preview={revocationPreview.data}
                                userId={userId}
                                onBack={clear}
                                onCompleted={(value) => {
                                    setResult({ kind: 'revoke', value });
                                    clear();
                                }}
                            />
                        ) : null}
                    </>
                ) : null}
                {actError ? <GrantRefusal error={actError} /> : null}
                {result?.kind === 'revoke' ? (
                    <PermanentGrantRevocationResult result={result.value} />
                ) : null}
                {result?.kind === 'grant' ? (
                    <p data-testid="permanent-grant-result">
                        {t('admin-billing.permanentGrants.resultGrant', {
                            id: result.value.permanentGrantId
                        })}
                    </p>
                ) : null}
                {result?.kind === 'anchor' ? (
                    <p data-testid="permanent-grant-result">
                        {t('admin-billing.permanentGrants.resultAnchor', {
                            id: result.value.anchorId
                        })}
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}
