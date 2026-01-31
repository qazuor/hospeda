/**
 * Roles Management Page Route
 *
 * Displays all system roles with their descriptions and access levels.
 * Read-only reference page showing role hierarchy and capabilities.
 */

import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { Edit, Globe, Home, Shield, ShieldAlert, User, Users } from 'lucide-react';

export const Route = createFileRoute('/_authed/access/roles')({
    component: RolesPage
});

interface RoleInfo {
    label: string;
    description: string;
    level: 'critical' | 'high' | 'medium' | 'low';
    icon: typeof Shield;
    capabilities: string[];
}

// Role descriptions and metadata
const ROLE_INFO: Record<RoleEnum, RoleInfo> = {
    [RoleEnum.SUPER_ADMIN]: {
        label: 'Super Admin',
        description: 'Full system access with all permissions including system-level actions',
        level: 'critical',
        icon: ShieldAlert,
        capabilities: [
            'Complete system control',
            'User and role management',
            'System configuration',
            'Audit log access',
            'All content management'
        ]
    },
    [RoleEnum.ADMIN]: {
        label: 'Admin',
        description: 'Manages platform content, users, and most administrative functions',
        level: 'high',
        icon: Shield,
        capabilities: [
            'Content moderation',
            'User management',
            'Accommodation approval',
            'Event management',
            'Analytics access'
        ]
    },
    [RoleEnum.CLIENT_MANAGER]: {
        label: 'Client Manager',
        description: 'Manages client accounts, billing, subscriptions, and business analytics',
        level: 'high',
        icon: Users,
        capabilities: [
            'Client account management',
            'Subscription management',
            'Billing and invoicing',
            'Payment processing',
            'Business analytics'
        ]
    },
    [RoleEnum.EDITOR]: {
        label: 'Editor',
        description: 'Creates and edits events, posts, and editorial content',
        level: 'medium',
        icon: Edit,
        capabilities: [
            'Create events',
            'Edit posts',
            'Publish content',
            'Manage media',
            'Content scheduling'
        ]
    },
    [RoleEnum.HOST]: {
        label: 'Host',
        description: 'Accommodation owner who manages their own listings',
        level: 'medium',
        icon: Home,
        capabilities: [
            'Manage own accommodations',
            'Update availability',
            'Upload photos',
            'Respond to reviews',
            'View booking analytics'
        ]
    },
    [RoleEnum.USER]: {
        label: 'User',
        description: 'Registered user of the public portal with basic interaction capabilities',
        level: 'low',
        icon: User,
        capabilities: [
            'View content',
            'Create reviews',
            'Save favorites',
            'Update profile',
            'Contact hosts'
        ]
    },
    [RoleEnum.SPONSOR]: {
        label: 'Sponsor',
        description:
            'External business sponsor with access to sponsorship management and analytics',
        level: 'low',
        icon: User,
        capabilities: ['Manage sponsorships', 'View sponsorship analytics', 'View invoices']
    },
    [RoleEnum.GUEST]: {
        label: 'Guest',
        description: 'Public visitor without authentication, limited to viewing public content',
        level: 'low',
        icon: Globe,
        capabilities: [
            'View public content',
            'Browse accommodations',
            'Search destinations',
            'View events',
            'Access public information'
        ]
    }
};

// Badge variant mapping for role levels
const LEVEL_VARIANTS: Record<
    RoleInfo['level'],
    'destructive' | 'default' | 'secondary' | 'outline'
> = {
    critical: 'destructive',
    high: 'default',
    medium: 'secondary',
    low: 'outline'
};

function RolesPage() {
    // Get roles in hierarchical order
    const roles = Object.values(RoleEnum);

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.accessRoles">
            <div className="space-y-6">
                {/* Page description */}
                <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-muted-foreground text-sm">
                        System roles define user access levels and permissions. Each role inherits
                        capabilities based on their position in the hierarchy. Roles are managed at
                        the system level and cannot be modified from this interface.
                    </p>
                </div>

                {/* Roles grid */}
                <div className="grid gap-6 md:grid-cols-2">
                    {roles.map((role) => {
                        const info = ROLE_INFO[role];
                        const Icon = info.icon;

                        return (
                            <Card
                                key={role}
                                className="flex flex-col"
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                <Icon className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">
                                                    {info.label}
                                                </CardTitle>
                                                <Badge
                                                    variant={LEVEL_VARIANTS[info.level]}
                                                    className="mt-1"
                                                >
                                                    {info.level.charAt(0).toUpperCase() +
                                                        info.level.slice(1)}{' '}
                                                    Access
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <p className="mb-4 text-muted-foreground text-sm">
                                        {info.description}
                                    </p>

                                    <div>
                                        <h4 className="mb-2 font-medium text-sm">
                                            Key Capabilities:
                                        </h4>
                                        <ul className="space-y-1">
                                            {info.capabilities.map((capability) => (
                                                <li
                                                    key={capability}
                                                    className="flex items-start gap-2 text-muted-foreground text-sm"
                                                >
                                                    <span className="mt-1 text-primary">•</span>
                                                    <span>{capability}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Info note */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                    <p className="text-blue-900 text-sm dark:text-blue-100">
                        <strong>Note:</strong> Individual permission details are managed through the
                        Permissions page. Users can be assigned to roles from the User Management
                        section.
                    </p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
