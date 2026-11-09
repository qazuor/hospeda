import type { TranslationKey } from '@repo/i18n';
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
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import {
    useAddonProductRetirement,
    useChangeAddonProductRetirement
} from './hooks/useAddonCatalog';

/** Action 20 saleability control for one product. */
export function AddonProductRetirement(input: { readonly productId: string }) {
    const { t } = useTranslations();
    const tr = (key: string) => t(`admin-billing.addonCatalogEditor.${key}` as TranslationKey);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const state = useAddonProductRetirement({ productId: input.productId });
    const mutation = useChangeAddonProductRetirement({ productId: input.productId });
    const retired = state.data?.retiredAt !== null;

    if (state.isLoading) return <p role="status">{tr('retirementLoading')}</p>;
    if (state.isError || !state.data) return <p role="alert">{tr('retirementError')}</p>;

    return (
        <div className="space-y-2">
            {retired ? (
                <p data-testid={`addon-product-retired-${input.productId}`}>{tr('retired')}</p>
            ) : null}
            <Button
                data-testid={`addon-product-retire-${input.productId}`}
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setConfirmOpen(true)}
            >
                {tr(retired ? 'unretire' : 'retire')}
            </Button>
            {mutation.isError ? <p role="alert">{tr('retirementError')}</p> : null}
            <AlertDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {tr(retired ? 'unretireTitle' : 'retireTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {tr(retired ? 'unretireConfirm' : 'retireConfirm')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tr('back')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => mutation.mutate(!retired)}>
                            {tr(retired ? 'unretire' : 'retire')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
