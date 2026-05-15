/**
 * Create Sponsorship Dialog
 *
 * SPEC-117 D-SPONSORSHIP.1 — wires the previously no-op "Crear patrocinio" button.
 * Minimum viable form: sponsor user, level, target (type + id), schedule window,
 * optional slug + linkUrl. Status defaults server-side to PENDING.
 */

import { useToast } from '@/components/ui/ToastProvider';
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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useCreateSponsorshipMutation } from '../hooks/useSponsorshipQueries';

interface CreateSponsorshipDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

interface FormState {
    sponsorUserId: string;
    levelId: string;
    targetType: 'event' | 'post';
    targetId: string;
    startsAt: string;
    endsAt: string;
    slug: string;
    linkUrl: string;
}

const INITIAL_STATE: FormState = {
    sponsorUserId: '',
    levelId: '',
    targetType: 'post',
    targetId: '',
    startsAt: '',
    endsAt: '',
    slug: '',
    linkUrl: ''
};

interface UserOption {
    id: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
}

interface LevelOption {
    id: string;
    name: string;
    targetType: 'event' | 'post';
}

export function CreateSponsorshipDialog({ open, onOpenChange }: CreateSponsorshipDialogProps) {
    const { addToast } = useToast();
    const mutation = useCreateSponsorshipMutation();
    const [values, setValues] = useState<FormState>(INITIAL_STATE);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

    // Pre-load top users so the sponsor dropdown is functional without typing.
    // Skips when the dialog is closed.
    const usersQuery = useQuery({
        queryKey: ['sponsorship-dialog-users'],
        queryFn: async () => {
            const r = await fetchApi<{
                success: boolean;
                data: { items: UserOption[] };
            }>({
                path: '/api/v1/admin/users?pageSize=100'
            });
            return r.data.data?.items ?? [];
        },
        enabled: open,
        staleTime: 60_000
    });

    const userLabel = (u: UserOption) =>
        u.displayName || [u.firstName ?? '', u.lastName ?? ''].join(' ').trim() || u.email || u.id;

    // Levels are filtered client-side by targetType so the admin cannot pair an
    // EVENT level with a POST sponsorship (server-side guard exists too).
    const levelsQuery = useQuery({
        queryKey: ['sponsorship-dialog-levels'],
        queryFn: async () => {
            const r = await fetchApi<{
                success: boolean;
                data: { items: LevelOption[] };
            }>({
                path: '/api/v1/admin/sponsorship-levels?pageSize=100'
            });
            return r.data.data?.items ?? [];
        },
        enabled: open,
        staleTime: 60_000
    });

    const filteredLevels = (levelsQuery.data ?? []).filter(
        (l) => l.targetType === values.targetType
    );

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setValues((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const reset = () => {
        setValues(INITIAL_STATE);
        setErrors({});
    };

    const handleSubmit = async () => {
        const nextErrors: Partial<Record<keyof FormState, string>> = {};
        if (!values.sponsorUserId) nextErrors.sponsorUserId = 'El patrocinador es obligatorio';
        if (!values.levelId) nextErrors.levelId = 'El nivel es obligatorio';
        if (!values.targetId.trim()) nextErrors.targetId = 'El ID del contenido es obligatorio';
        if (!values.startsAt) nextErrors.startsAt = 'La fecha de inicio es obligatoria';
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        const payload: Record<string, unknown> = {
            sponsorUserId: values.sponsorUserId,
            levelId: values.levelId,
            targetType: values.targetType,
            targetId: values.targetId.trim(),
            startsAt: new Date(values.startsAt).toISOString()
        };
        if (values.endsAt) payload.endsAt = new Date(values.endsAt).toISOString();
        if (values.slug.trim()) payload.slug = values.slug.trim();
        if (values.linkUrl.trim()) payload.linkUrl = values.linkUrl.trim();

        try {
            await mutation.mutateAsync(payload);
            addToast({
                title: 'Patrocinio creado',
                message: 'El patrocinio se creó exitosamente',
                variant: 'success'
            });
            reset();
            onOpenChange(false);
        } catch (error) {
            adminLogger.error('[CreateSponsorshipDialog] Submit failed', error);
            addToast({
                title: 'Error al crear el patrocinio',
                message:
                    error instanceof Error
                        ? error.message
                        : 'No pudimos crear el patrocinio. Probá de nuevo.',
                variant: 'error'
            });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) reset();
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Crear patrocinio</DialogTitle>
                    <DialogDescription>
                        Asigná un patrocinador y nivel a un post o evento existente.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label htmlFor="cs-sponsor">Patrocinador*</Label>
                        <Select
                            value={values.sponsorUserId}
                            onValueChange={(v) => setField('sponsorUserId', v)}
                        >
                            <SelectTrigger id="cs-sponsor">
                                <SelectValue
                                    placeholder={
                                        usersQuery.isLoading
                                            ? 'Cargando usuarios...'
                                            : 'Seleccioná un usuario'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {(usersQuery.data ?? []).map((u) => (
                                    <SelectItem
                                        key={u.id}
                                        value={u.id}
                                    >
                                        {userLabel(u)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.sponsorUserId && (
                            <p className="text-destructive text-sm">{errors.sponsorUserId}</p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="cs-level">Nivel*</Label>
                        <Select
                            value={values.levelId}
                            onValueChange={(v) => setField('levelId', v)}
                        >
                            <SelectTrigger id="cs-level">
                                <SelectValue
                                    placeholder={
                                        levelsQuery.isLoading
                                            ? 'Cargando niveles...'
                                            : filteredLevels.length === 0
                                              ? `Sin niveles para ${values.targetType === 'event' ? 'eventos' : 'posts'}`
                                              : 'Seleccioná un nivel'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredLevels.map((l) => (
                                    <SelectItem
                                        key={l.id}
                                        value={l.id}
                                    >
                                        {l.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.levelId && (
                            <p className="text-destructive text-sm">{errors.levelId}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cs-target-type">Tipo de contenido*</Label>
                            <Select
                                value={values.targetType}
                                onValueChange={(v) => {
                                    const next = v as 'event' | 'post';
                                    // Reset levelId if it no longer matches the new targetType.
                                    setValues((prev) => ({
                                        ...prev,
                                        targetType: next,
                                        levelId: ''
                                    }));
                                    setErrors((prev) => {
                                        const cleared = { ...prev };
                                        cleared.targetType = undefined as never;
                                        cleared.levelId = undefined as never;
                                        return cleared;
                                    });
                                }}
                            >
                                <SelectTrigger id="cs-target-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="post">Post</SelectItem>
                                    <SelectItem value="event">Evento</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cs-target-id">
                                ID del {values.targetType === 'event' ? 'evento' : 'post'}*
                            </Label>
                            <Input
                                id="cs-target-id"
                                value={values.targetId}
                                onChange={(e) => setField('targetId', e.target.value)}
                                placeholder="UUID"
                            />
                            {errors.targetId && (
                                <p className="text-destructive text-sm">{errors.targetId}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cs-starts">Inicio*</Label>
                            <Input
                                id="cs-starts"
                                type="date"
                                value={values.startsAt}
                                onChange={(e) => setField('startsAt', e.target.value)}
                            />
                            {errors.startsAt && (
                                <p className="text-destructive text-sm">{errors.startsAt}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cs-ends">Fin (opcional)</Label>
                            <Input
                                id="cs-ends"
                                type="date"
                                value={values.endsAt}
                                onChange={(e) => setField('endsAt', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cs-slug">Slug (opcional)</Label>
                            <Input
                                id="cs-slug"
                                value={values.slug}
                                onChange={(e) => setField('slug', e.target.value)}
                                placeholder="Auto si vacío"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cs-link">URL de destino (opcional)</Label>
                            <Input
                                id="cs-link"
                                type="url"
                                value={values.linkUrl}
                                onChange={(e) => setField('linkUrl', e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={mutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? 'Creando...' : 'Crear patrocinio'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
