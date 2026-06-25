import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { fetchApi } from '@/lib/api/fetch-api';
/**
 * Create Feature Flag page — admin panel.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

function CreateFeatureFlag() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            key: formData.get('key') as string,
            description: formData.get('description') as string,
            enabled: formData.get('enabled') === 'on',
            isActive: formData.get('isActive') === 'on',
            forceOnUserIds: [],
            forceOffUserIds: [],
            enabledForRoles: []
        };

        try {
            await fetchApi('/api/v1/admin/feature-flags', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            toast.success('Feature flag created');
            navigate({ to: '/platform/feature-flags' });
        } catch (error) {
            toast.error('Failed to create feature flag');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto max-w-4xl py-8">
            <div className="mb-8">
                <h1 className="font-bold text-3xl">Create Feature Flag</h1>
                <p className="text-muted-foreground">
                    Create a new feature flag for dark launch or kill switch functionality.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Feature Flag Details</CardTitle>
                    <CardDescription>
                        Configure the initial state and behavior of your feature flag.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="key">Key *</Label>
                            <Input
                                id="key"
                                name="key"
                                placeholder="e.g., calendar, ai_image_enhance, new_search_ui"
                                required
                                pattern="[a-z0-9_-]+"
                                title="Lowercase letters, numbers, hyphens and underscores only"
                            />
                            <p className="text-muted-foreground text-sm">
                                Unique identifier for this flag. Used in code to check the flag
                                state.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="What does this feature do?"
                                rows={3}
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="enabled"
                                name="enabled"
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
                                defaultChecked
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
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Creating...' : 'Create Feature Flag'}
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
        </div>
    );
}

export const Route = createFileRoute('/_authed/platform/feature-flags/new')({
    component: CreateFeatureFlag
});

export default CreateFeatureFlag;
