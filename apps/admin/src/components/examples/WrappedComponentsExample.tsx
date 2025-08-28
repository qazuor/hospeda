/**
 * @file Wrapped Components Example
 *
 * This file demonstrates how to use the new wrapped UI components
 * and icon system in place of direct Shadcn imports.
 */

import { Icon } from '@/components/icons';
import { BaseLayout } from '@/components/layouts/BaseLayout';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input
} from '@/components/ui-wrapped';
import { useState } from 'react';

/**
 * Example component showing wrapped components usage
 */
export const WrappedComponentsExample = () => {
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const handleSave = async () => {
        setLoading(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setLoading(false);
    };

    return (
        <BaseLayout
            title="Wrapped Components Example"
            description="Demonstration of the new wrapped UI components and icon system"
            breadcrumbs={[
                { label: 'Dashboard', href: '/' },
                { label: 'Examples', href: '/examples' },
                { label: 'Wrapped Components' }
            ]}
            actions={
                <Button variant="outline">
                    <Icon
                        name="settings"
                        size="sm"
                        className="mr-2"
                    />
                    Settings
                </Button>
            }
        >
            <div className="space-y-6">
                {/* Button Examples */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Icon
                                name="settings"
                                className="mr-2"
                            />
                            Button Examples
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-3">
                            <Button>Default Button</Button>

                            <Button
                                variant="outline"
                                leftIcon={
                                    <Icon
                                        name="add"
                                        size="sm"
                                    />
                                }
                            >
                                With Left Icon
                            </Button>

                            <Button
                                variant="destructive"
                                rightIcon={
                                    <Icon
                                        name="delete"
                                        size="sm"
                                    />
                                }
                            >
                                With Right Icon
                            </Button>

                            <Button
                                loading={loading}
                                onClick={handleSave}
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Button>

                            <Button
                                fullWidth
                                variant="secondary"
                            >
                                Full Width Button
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Input Examples */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Icon
                                name="edit"
                                className="mr-2"
                            />
                            Input Examples
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Input
                                label="Basic Input"
                                placeholder="Enter some text..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                            />

                            <Input
                                label="Search Input"
                                leftIcon={
                                    <Icon
                                        name="search"
                                        size="sm"
                                    />
                                }
                                placeholder="Search..."
                            />

                            <Input
                                label="Email Input"
                                type="email"
                                required
                                rightIcon={
                                    <Icon
                                        name="email"
                                        size="sm"
                                    />
                                }
                                helperText="We'll never share your email"
                            />

                            <Input
                                label="Error State"
                                error
                                errorMessage="This field is required"
                                placeholder="This has an error"
                            />

                            <Input
                                label="Loading State"
                                loading
                                placeholder="Loading..."
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Badge Examples */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Icon
                                name="tags"
                                className="mr-2"
                            />
                            Badge Examples
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-3">
                            <Badge>Default</Badge>
                            <Badge variant="secondary">Secondary</Badge>
                            <Badge variant="success">Success</Badge>
                            <Badge variant="destructive">Error</Badge>
                            <Badge variant="outline">Outline</Badge>

                            <Badge
                                leftIcon={
                                    <Icon
                                        name="user"
                                        size="xs"
                                    />
                                }
                            >
                                With Icon
                            </Badge>

                            <Badge size="sm">Small</Badge>
                            <Badge size="lg">Large</Badge>

                            <Badge
                                dot
                                variant="success"
                            />
                            <Badge
                                dot
                                variant="destructive"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Icon Examples */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Icon
                                name="home"
                                className="mr-2"
                            />
                            Icon Examples
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <h4 className="mb-2 font-medium">Sizes:</h4>
                                <div className="flex items-center gap-3">
                                    <Icon
                                        name="star"
                                        size="xs"
                                    />
                                    <Icon
                                        name="star"
                                        size="sm"
                                    />
                                    <Icon
                                        name="star"
                                        size="md"
                                    />
                                    <Icon
                                        name="star"
                                        size="lg"
                                    />
                                    <Icon
                                        name="star"
                                        size="xl"
                                    />
                                    <Icon
                                        name="star"
                                        size="2xl"
                                    />
                                </div>
                            </div>

                            <div>
                                <h4 className="mb-2 font-medium">Variants:</h4>
                                <div className="flex items-center gap-3">
                                    <Icon
                                        name="alert-triangle"
                                        variant="default"
                                    />
                                    <Icon
                                        name="alert-triangle"
                                        variant="muted"
                                    />
                                    <Icon
                                        name="alert-triangle"
                                        variant="success"
                                    />
                                    <Icon
                                        name="alert-triangle"
                                        variant="warning"
                                    />
                                    <Icon
                                        name="alert-triangle"
                                        variant="error"
                                    />
                                    <Icon
                                        name="alert-triangle"
                                        variant="primary"
                                    />
                                </div>
                            </div>

                            <div>
                                <h4 className="mb-2 font-medium">Common Icons:</h4>
                                <div className="grid grid-cols-6 gap-4 sm:grid-cols-8 lg:grid-cols-12">
                                    {(
                                        [
                                            'home',
                                            'user',
                                            'users',
                                            'settings',
                                            'search',
                                            'edit',
                                            'delete',
                                            'add',
                                            'save',
                                            'cancel',
                                            'confirm',
                                            'loader',
                                            'menu',
                                            'close',
                                            'filter',
                                            'sort',
                                            'refresh',
                                            'download'
                                        ] as const
                                    ).map((iconName) => (
                                        <div
                                            key={iconName}
                                            className="flex flex-col items-center gap-1"
                                        >
                                            <Icon
                                                name={iconName}
                                                size="lg"
                                            />
                                            <span className="text-gray-500 text-xs">
                                                {iconName}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </BaseLayout>
    );
};
