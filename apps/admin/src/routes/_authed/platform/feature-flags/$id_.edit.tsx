import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { fetchApi } from '@/lib/api/fetch-api';
import type { FeatureFlag } from '@repo/schemas';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
/**
 * Edit Feature Flag page — admin panel.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

function EditFeatureFlag({ params }: { params: { id: string } }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: flag } = useSuspenseQuery<FeatureFlag>({
        queryKey: ['feature-flag', params.id],
        queryFn: async () => {
            const response = await fetchApi(`/api/v1/admin/feature-flags/${params.id}`);
            return response as FeatureFlag;
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<FeatureFlag>) => {
            const response = await fetchApi(`/api/v1/admin/feature-flags/${params.id}`, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
            return response as FeatureFlag;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feature-flag', params.id] });
            queryClient.invalidateQueries({ queryKey: ['feature-flags', 'list'] });
            toast.success('Feature flag updated');
            navigate({ to: '/platform/feature-flags' });
        },
        onError: () => {
            toast.error('Failed to update feature flag');
        }
    });

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            key: formData.get('key') as string,
            description: formData.get('description') as string,
            enabled: formData.get('enabled') === 'on',
            isActive: formData.get('isActive') === 'on'
        };

        updateMutation.mutate(data);
    };

    return (
        <div className="container mx-auto max-w-4xl py-8">
            <div className="mb-8">
                <h1 className="font-bold font-mono text-3xl">{flag.key}</h1>
                <p className="text-muted-foreground">Edit feature flag configuration</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Feature Flag Details</CardTitle>
                    <CardDescription>
                        Update the configuration of your feature flag.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6"
                    >
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

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="enabled"
                                name="enabled"
                                defaultChecked={flag.enabled}
                            />
                            <Label htmlFor="enabled">Enabled by default</Label>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            When enabled, this flag will be ON for all users (unless overridden).
                        </p>

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

                        <div className="flex gap-4">
                            <Button
                                type="submit"
                                disabled={isSubmitting || updateMutation.isPending}
                            >
                                {isSubmitting || updateMutation.isPending
                                    ? 'Saving...'
                                    : 'Save Changes'}
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
                </CardContent>
            </Card>

            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Current Overrides</CardTitle>
                    <CardDescription>
                        User and role-specific overrides (advanced — use API for management)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <div className="font-medium text-sm">Force ON Users</div>
                        <div className="font-mono text-muted-foreground text-sm">
                            {flag.forceOnUserIds?.length ?? 0} users configured
                        </div>
                    </div>
                    <div>
                        <div className="font-medium text-sm">Force OFF Users</div>
                        <div className="font-mono text-muted-foreground text-sm">
                            {flag.forceOffUserIds?.length ?? 0} users configured
                        </div>
                    </div>
                    <div>
                        <div className="font-medium text-sm">Enabled for Roles</div>
                        <div className="text-muted-foreground text-sm">
                            {flag.enabledForRoles?.join(', ') || 'None'}
                        </div>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        To modify overrides, use the API endpoints or contact support.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

export const Route = createFileRoute('/_authed/platform/feature-flags/$id_.edit')({
    component: EditFeatureFlag,
    loader: async ({ params, context }) => {
        await context.queryClient.ensureQueryData({
            queryKey: ['feature-flag', params.id],
            queryFn: async () => {
                const response = await fetchApi(`/api/v1/admin/feature-flags/${params.id}`);
                return response as FeatureFlag;
            }
        });
    }
});

export default EditFeatureFlag;
