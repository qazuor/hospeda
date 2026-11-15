import type { TranslationKey } from '@repo/i18n';
import type { VerticalEnum } from '@repo/schemas';
import { CreatePlanRequestSchema, PLAN_ROLES } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { useCreatePlan } from '../hooks/usePlanCatalog';

type CreatePlanValues = {
    slug: string;
    name: string;
    description: string;
    pricingOrder: string;
    role: string;
};

/** Creates a plan in the currently selected vertical. */
export function CreatePlanDialog({
    open,
    vertical,
    onOpenChange,
    onCreated
}: {
    readonly open: boolean;
    readonly vertical: VerticalEnum;
    readonly onOpenChange: (open: boolean) => void;
    readonly onCreated: () => void;
}) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(key as TranslationKey, values);
    const root = 'admin-billing.planCatalogEditor.';
    const create = useCreatePlan();
    const [error, setError] = useState<string | null>(null);
    const form = useForm<CreatePlanValues>({
        defaultValues: { slug: '', name: '', description: '', pricingOrder: '', role: '' },
        onSubmit: async ({ value }) => {
            setError(null);
            const body = {
                vertical,
                slug: value.slug.trim(),
                name: value.name.trim(),
                ...(value.description.trim() ? { description: value.description.trim() } : {}),
                ...(value.pricingOrder.trim() ? { pricingOrder: Number(value.pricingOrder) } : {}),
                ...(value.role ? { role: value.role } : {})
            };
            const parsed = CreatePlanRequestSchema.safeParse(body);
            if (!parsed.success) {
                setError(
                    tr(`${root}errors.invalid`, { message: parsed.error.issues[0]?.message ?? '' })
                );
                return;
            }
            try {
                await create.mutateAsync(parsed.data);
                onCreated();
                form.reset();
                onOpenChange(false);
            } catch (reason) {
                if (isApiError(reason) && reason.status === 403)
                    setError(tr(`${root}errors.forbidden`));
                else if (isApiError(reason) && (reason.status === 400 || reason.status === 409))
                    setError(tr(`${root}errors.rejected`, { message: reason.message }));
                else setError(tr(`${root}errors.generic`));
            }
        }
    });
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) setError(null);
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{tr(`${root}createPlan.title`)}</DialogTitle>
                    <DialogDescription>{tr(`${root}intro`)}</DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void form.handleSubmit();
                    }}
                >
                    <FormInput
                        form={form}
                        name="slug"
                        label={tr(`${root}createPlan.slug`)}
                    />
                    <FormInput
                        form={form}
                        name="name"
                        label={tr(`${root}createPlan.name`)}
                    />
                    <FormInput
                        form={form}
                        name="description"
                        label={tr(`${root}createPlan.description`)}
                    />
                    <FormInput
                        form={form}
                        name="pricingOrder"
                        label={tr(`${root}createPlan.pricingOrder`)}
                        type="number"
                    />
                    <form.Field name="role">
                        {(field) => (
                            <label className="block space-y-1 text-sm">
                                {tr(`${root}createPlan.role`)}
                                <select
                                    className="h-10 w-full rounded-md border bg-background px-3"
                                    value={field.state.value}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                >
                                    <option value="" />
                                    {PLAN_ROLES.map((role) => (
                                        <option
                                            key={role}
                                            value={role}
                                        >
                                            {tr(`${root}roles.${role}`)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </form.Field>
                    {error ? <p role="alert">{error}</p> : null}
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={create.isPending}
                        >
                            {tr(`${root}createPlan.submit`)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function FormInput({
    form,
    name,
    label,
    type = 'text'
}: {
    readonly form: ReturnType<typeof useForm<CreatePlanValues>>;
    readonly name: keyof CreatePlanValues;
    readonly label: string;
    readonly type?: string;
}) {
    return (
        <form.Field name={name}>
            {(field) => (
                <div className="space-y-1 text-sm">
                    <label htmlFor={`create-plan-${String(name)}`}>{label}</label>
                    <Input
                        id={`create-plan-${String(name)}`}
                        type={type}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                    />
                </div>
            )}
        </form.Field>
    );
}
