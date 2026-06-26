import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { fetchApi } from '@/lib/api/client';
import { RoleEnum } from '@repo/schemas';
import type { FeatureFlag } from '@repo/schemas';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
/**
 * Edit Feature Flag page — admin panel.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/platform/feature-flags/$id_/edit')({
    component: EditFeatureFlag,
    loader: async ({ params }) => ({ id: params.id })
});

const OVERRIDE_ROLES = [
    RoleEnum.SUPER_ADMIN,
    RoleEnum.ADMIN,
    RoleEnum.CLIENT_MANAGER,
    RoleEnum.EDITOR,
    RoleEnum.HOST,
    RoleEnum.COMMERCE_OWNER,
    RoleEnum.SPONSOR,
    RoleEnum.USER
] as const;

function EditFeatureFlag() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addToast } = useToast();

    const { data: flag } = useSuspenseQuery<FeatureFlag>({
        queryKey: ['feature-flag', id],
        queryFn: async () => {
            const response = await fetchApi<FeatureFlag>({
                path: `/api/v1/admin/feature-flags/${id}`
            });
            return response.data;
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<FeatureFlag>) => {
            const response = await fetchApi<FeatureFlag>({
                path: `/api/v1/admin/feature-flags/${id}`,
                method: 'PATCH',
                body: data
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feature-flag', id] });
            queryClient.invalidateQueries({ queryKey: ['feature-flags', 'list'] });
            addToast({ message: 'Feature flag updated', variant: 'success' });
            navigate({ to: '/platform/feature-flags' });
        },
        onError: () => {
            addToast({ message: 'Failed to update feature flag', variant: 'error' });
        }
    });

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);

        const parseIds = (raw: string) =>
            raw
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);

        const enabledForRoles = OVERRIDE_ROLES.filter(
            (role) => formData.get(`role_${role}`) === 'on'
        );

        const data = {
            key: formData.get('key') as string,
            description: formData.get('description') as string,
            enabled: formData.get('enabled') === 'on',
            isActive: formData.get('isActive') === 'on',
            forceOnUserIds: parseIds(formData.get('forceOnUserIds') as string),
            forceOffUserIds: parseIds(formData.get('forceOffUserIds') as string),
            enabledForRoles
        };

        updateMutation.mutate(data);
        setIsSubmitting(false);
    };

    return (
        <div className="container mx-auto max-w-4xl py-8">
            <div className="mb-8">
                <h1 className="font-bold font-mono text-3xl">{flag.key}</h1>
                <p className="text-muted-foreground">Edit feature flag configuration</p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="space-y-6"
            >
                <Card>
                    <CardHeader>
                        <CardTitle>Feature Flag Details</CardTitle>
                        <CardDescription>
                            Update the configuration of your feature flag.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="key">Key</Label>
                            <Input
                                id="key"
                                name="key"
                                defaultValue={flag.key}
                                required
                                pattern="[a-z0-9_-]+"
                            />
                            <p className="text-muted-foreground text-sm">
                                Unique identifier for this flag.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                name="description"
                                defaultValue={flag.description || ''}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="enabled"
                                    name="enabled"
                                    defaultChecked={flag.enabled}
                                />
                                <Label htmlFor="enabled">Enabled by default</Label>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                When enabled, this flag will be ON for all users (unless
                                overridden).
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="isActive"
                                    name="isActive"
                                    defaultChecked={flag.isActive}
                                />
                                <Label htmlFor="isActive">Active (Kill Switch)</Label>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                Master switch. When OFF, the flag is OFF for everyone regardless of
                                other settings.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>User Overrides</CardTitle>
                        <CardDescription>
                            Per-user force-on / force-off. One UUID per line.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="forceOnUserIds">Force ON — User IDs</Label>
                            <Textarea
                                id="forceOnUserIds"
                                name="forceOnUserIds"
                                defaultValue={(flag.forceOnUserIds ?? []).join('\n')}
                                rows={4}
                                placeholder="One user UUID per line"
                                className="font-mono text-sm"
                            />
                            <p className="text-muted-foreground text-sm">
                                These users always see the feature ON, even if the default is OFF.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="forceOffUserIds">Force OFF — User IDs</Label>
                            <Textarea
                                id="forceOffUserIds"
                                name="forceOffUserIds"
                                defaultValue={(flag.forceOffUserIds ?? []).join('\n')}
                                rows={4}
                                placeholder="One user UUID per line"
                                className="font-mono text-sm"
                            />
                            <p className="text-muted-foreground text-sm">
                                These users always see the feature OFF. Force-off wins over
                                everything.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Role Overrides</CardTitle>
                        <CardDescription>
                            Enable the feature for specific roles (staff testing).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {OVERRIDE_ROLES.map((role) => (
                                <div
                                    key={role}
                                    className="flex items-center space-x-2"
                                >
                                    <Switch
                                        id={`role_${role}`}
                                        name={`role_${role}`}
                                        defaultChecked={(flag.enabledForRoles ?? []).includes(role)}
                                    />
                                    <Label
                                        htmlFor={`role_${role}`}
                                        className="font-mono text-sm"
                                    >
                                        {role}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        <p className="mt-3 text-muted-foreground text-sm">
                            Users with these roles see the feature ON, even if the default is OFF.
                        </p>
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Button
                        type="submit"
                        disabled={isSubmitting || updateMutation.isPending}
                    >
                        {isSubmitting || updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate({ to: '/platform/feature-flags' })}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default EditFeatureFlag;
