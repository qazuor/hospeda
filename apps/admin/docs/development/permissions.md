# Permissions Guide

Complete guide to RBAC (Role-Based Access Control) implementation in the Hospeda Admin Dashboard.

---

## 📖 Overview

The admin dashboard implements **Role-Based Access Control (RBAC)** to manage user permissions and access levels. This system controls what users can see and do based on their assigned roles.

**What you'll learn:**

- Permission system architecture
- Role definitions and hierarchy
- Permission checking in components
- Permission enforcement in API routes
- Using Clerk organizations and roles
- Custom permission hooks
- Conditional rendering based on permissions
- Best practices for permission management

**Prerequisites:**

- Read [Authentication Guide](./authentication.md)
- Understanding of Clerk authentication
- Basic knowledge of TypeScript
- Familiarity with React hooks

---

## 🎯 Quick Start

### Check User Role

```tsx
import { useAuth } from '@clerk/tanstack-react-start';

export function MyComponent() {
  const { sessionClaims } = useAuth();
  const userRole = sessionClaims?.role as string;

  if (userRole === 'admin') {
    return <AdminPanel />;
  }

  return <ViewerPanel />;
}
```

### Conditional Rendering

```tsx
export function ActionButtons() {
  const { can } = usePermissions();

  return (
    <div>
      {can('accommodations:read') && <ViewButton />}
      {can('accommodations:edit') && <EditButton />}
      {can('accommodations:delete') && <DeleteButton />}
    </div>
  );
}
```

---

## 🏗️ Permission System Architecture

### Role Hierarchy

The system defines 4 role levels with cascading permissions:

```text
Admin (Level 4)
├── Full system access
├── User management
├── All CRUD operations
└── System configuration

Manager (Level 3)
├── Manage own organization
├── Create/edit/delete content
├── View analytics
└── Cannot manage users

Editor (Level 2)
├── Create content
├── Edit own content
├── Cannot delete
└── Limited analytics

Viewer (Level 1)
├── Read-only access
├── View content
└── No modifications
```

### Permission Structure

Permissions follow the format: `resource:action`

```typescript
type Permission =
  | 'accommodations:read'
  | 'accommodations:create'
  | 'accommodations:edit'
  | 'accommodations:delete'
  | 'users:read'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  | 'settings:read'
  | 'settings:edit'
  | 'analytics:read';
```

### Role-Permission Mapping

```typescript
const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    'accommodations:read',
    'accommodations:create',
    'accommodations:edit',
    'accommodations:delete',
    'users:read',
    'users:create',
    'users:edit',
    'users:delete',
    'settings:read',
    'settings:edit',
    'analytics:read',
  ],
  manager: [
    'accommodations:read',
    'accommodations:create',
    'accommodations:edit',
    'accommodations:delete',
    'analytics:read',
  ],
  editor: [
    'accommodations:read',
    'accommodations:create',
    'accommodations:edit',
  ],
  viewer: [
    'accommodations:read',
  ],
};
```

---

## 🔑 Role Definitions

### Admin Role

**Capabilities:**

- Full system access
- User management
- System configuration
- All CRUD operations
- View all data

**Use cases:**

- System administrators
- Platform owners
- Technical support

**Example:**

```tsx
export function AdminDashboard() {
  const { hasRole } = usePermissions();

  if (!hasRole('admin')) {
    return <AccessDenied />;
  }

  return (
    <div>
      <UserManagement />
      <SystemSettings />
      <AllAccommodations />
    </div>
  );
}
```

### Manager Role

**Capabilities:**

- Manage organization content
- Create, edit, delete accommodations
- View analytics
- Cannot manage users

**Use cases:**

- Property managers
- Content managers
- Team leads

**Example:**

```tsx
export function ManagerDashboard() {
  const { hasRole } = usePermissions();

  if (!hasRole('manager')) {
    return <AccessDenied />;
  }

  return (
    <div>
      <OrganizationAccommodations />
      <Analytics />
      <ContentTools />
    </div>
  );
}
```

### Editor Role

**Capabilities:**

- Create accommodations
- Edit own accommodations
- View accommodations
- Cannot delete

**Use cases:**

- Content editors
- Data entry staff
- Contractors

**Example:**

```tsx
export function EditorView() {
  const { can } = usePermissions();

  return (
    <div>
      {can('accommodations:create') && <CreateButton />}
      {can('accommodations:edit') && <EditButton />}
      {/* Delete button hidden - no permission */}
    </div>
  );
}
```

### Viewer Role

**Capabilities:**

- Read-only access
- View accommodations
- View basic analytics
- No modifications

**Use cases:**

- Auditors
- Read-only staff
- External reviewers

**Example:**

```tsx
export function ViewerDashboard() {
  const { hasRole } = usePermissions();

  if (!hasRole('viewer')) {
    return <AccessDenied />;
  }

  return (
    <div>
      <AccommodationsList readOnly />
      <BasicAnalytics />
    </div>
  );
}
```

---

## 🛠️ Custom Permission Hooks

### usePermissions Hook

Create a custom hook for permission checks:

```tsx
// src/hooks/use-permissions.ts
import { useAuth } from '@clerk/tanstack-react-start';

type Role = 'admin' | 'manager' | 'editor' | 'viewer';
type Permission = string;

const roleHierarchy: Record<Role, number> = {
  admin: 4,
  manager: 3,
  editor: 2,
  viewer: 1,
};

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    'accommodations:read',
    'accommodations:create',
    'accommodations:edit',
    'accommodations:delete',
    'users:read',
    'users:create',
    'users:edit',
    'users:delete',
    'settings:read',
    'settings:edit',
    'analytics:read',
  ],
  manager: [
    'accommodations:read',
    'accommodations:create',
    'accommodations:edit',
    'accommodations:delete',
    'analytics:read',
  ],
  editor: [
    'accommodations:read',
    'accommodations:create',
    'accommodations:edit',
  ],
  viewer: ['accommodations:read'],
};

export function usePermissions() {
  const { sessionClaims } = useAuth();
  const userRole = (sessionClaims?.role as Role) || 'viewer';

  const hasRole = (role: Role): boolean => {
    return roleHierarchy[userRole] >= roleHierarchy[role];
  };

  const can = (permission: Permission): boolean => {
    const permissions = rolePermissions[userRole] || [];
    return permissions.includes(permission);
  };

  const canAny = (permissions: Permission[]): boolean => {
    return permissions.some((permission) => can(permission));
  };

  const canAll = (permissions: Permission[]): boolean => {
    return permissions.every((permission) => can(permission));
  };

  return {
    role: userRole,
    hasRole,
    can,
    canAny,
    canAll,
  };
}
```

**Usage:**

```tsx
export function AccommodationActions({ accommodation }) {
  const { can } = usePermissions();

  return (
    <div className="flex gap-2">
      {can('accommodations:read') && (
        <Button onClick={() => viewAccommodation(accommodation.id)}>
          View
        </Button>
      )}

      {can('accommodations:edit') && (
        <Button onClick={() => editAccommodation(accommodation.id)}>
          Edit
        </Button>
      )}

      {can('accommodations:delete') && (
        <Button onClick={() => deleteAccommodation(accommodation.id)}>
          Delete
        </Button>
      )}
    </div>
  );
}
```

### useRequireRole Hook

Enforce role requirements:

```tsx
// src/hooks/use-require-role.ts
import { usePermissions } from './use-permissions';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

type Role = 'admin' | 'manager' | 'editor' | 'viewer';

export function useRequireRole(requiredRole: Role) {
  const { hasRole } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasRole(requiredRole)) {
      navigate({ to: '/dashboard' });
    }
  }, [hasRole, requiredRole, navigate]);

  return hasRole(requiredRole);
}
```

**Usage:**

```tsx
export function AdminPanel() {
  const hasAccess = useRequireRole('admin');

  if (!hasAccess) {
    return <LoadingSpinner />;
  }

  return <div>Admin content</div>;
}
```

### useResourcePermissions Hook

Check permissions for specific resources:

```tsx
// src/hooks/use-resource-permissions.ts
import { usePermissions } from './use-permissions';

type Resource = 'accommodations' | 'users' | 'settings' | 'analytics';
type Action = 'read' | 'create' | 'edit' | 'delete';

export function useResourcePermissions(resource: Resource) {
  const { can } = usePermissions();

  const canRead = can(`${resource}:read`);
  const canCreate = can(`${resource}:create`);
  const canEdit = can(`${resource}:edit`);
  const canDelete = can(`${resource}:delete`);

  const canDo = (action: Action) => can(`${resource}:${action}`);

  return {
    canRead,
    canCreate,
    canEdit,
    canDelete,
    canDo,
  };
}
```

**Usage:**

```tsx
export function AccommodationPage() {
  const { canRead, canEdit, canDelete } = useResourcePermissions('accommodations');

  if (!canRead) {
    return <AccessDenied />;
  }

  return (
    <div>
      <AccommodationDetails />
      {canEdit && <EditButton />}
      {canDelete && <DeleteButton />}
    </div>
  );
}
```

---

## 🎨 Permission-Based UI Components

### PermissionGuard Component

Wrapper component for permission-based rendering:

```tsx
// src/components/PermissionGuard.tsx
import { usePermissions } from '@/hooks/use-permissions';
import type { ReactNode } from 'react';

type PermissionGuardProps = {
  permission?: string;
  role?: 'admin' | 'manager' | 'editor' | 'viewer';
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGuard({
  permission,
  role,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { can, hasRole } = usePermissions();

  // Check permission if provided
  if (permission && !can(permission)) {
    return <>{fallback}</>;
  }

  // Check role if provided
  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

**Usage:**

```tsx
export function AccommodationCard({ accommodation }) {
  return (
    <div className="card">
      <h3>{accommodation.name}</h3>

      <PermissionGuard permission="accommodations:edit">
        <button>Edit</button>
      </PermissionGuard>

      <PermissionGuard
        permission="accommodations:delete"
        fallback={<span className="text-gray-400">Delete (no permission)</span>}
      >
        <button>Delete</button>
      </PermissionGuard>
    </div>
  );
}
```

### RoleGuard Component

Role-based rendering:

```tsx
// src/components/RoleGuard.tsx
import { usePermissions } from '@/hooks/use-permissions';
import type { ReactNode } from 'react';

type RoleGuardProps = {
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  fallback?: ReactNode;
  children: ReactNode;
};

export function RoleGuard({ role, fallback = null, children }: RoleGuardProps) {
  const { hasRole } = usePermissions();

  if (!hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

**Usage:**

```tsx
export function Navigation() {
  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/accommodations">Accommodations</Link>

      <RoleGuard role="manager">
        <Link to="/analytics">Analytics</Link>
      </RoleGuard>

      <RoleGuard role="admin">
        <Link to="/users">Users</Link>
        <Link to="/settings">Settings</Link>
      </RoleGuard>
    </nav>
  );
}
```

### Conditional Action Button

```tsx
// src/components/ConditionalActionButton.tsx
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';

type ConditionalActionButtonProps = {
  permission: string;
  onClick: () => void;
  children: React.ReactNode;
  showDisabled?: boolean;
};

export function ConditionalActionButton({
  permission,
  onClick,
  children,
  showDisabled = false,
}: ConditionalActionButtonProps) {
  const { can } = usePermissions();
  const hasPermission = can(permission);

  if (!hasPermission && !showDisabled) {
    return null;
  }

  return (
    <Button onClick={onClick} disabled={!hasPermission}>
      {children}
    </Button>
  );
}
```

**Usage:**

```tsx
export function AccommodationActions() {
  return (
    <div className="flex gap-2">
      <ConditionalActionButton
        permission="accommodations:edit"
        onClick={handleEdit}
      >
        Edit
      </ConditionalActionButton>

      <ConditionalActionButton
        permission="accommodations:delete"
        onClick={handleDelete}
        showDisabled
      >
        Delete
      </ConditionalActionButton>
    </div>
  );
}
```

---

## 🔒 Route-Level Permissions

### Protected Route with Role Check

```tsx
// src/routes/_authed/_admin.tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getAuth } from '@clerk/tanstack-react-start/server';
import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/react-start/server';

const checkAdminAccess = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getWebRequest();
  const { userId, sessionClaims } = await getAuth(request);

  return {
    userId,
    role: sessionClaims?.role as string,
    isAdmin: sessionClaims?.role === 'admin',
  };
});

export const Route = createFileRoute('/_authed/_admin')({
  beforeLoad: async () => {
    const authState = await checkAdminAccess();

    if (!authState.userId) {
      throw redirect({ to: '/auth/signin' });
    }

    if (!authState.isAdmin) {
      throw redirect({
        to: '/dashboard',
        search: {
          error: 'Insufficient permissions',
        },
      });
    }

    return authState;
  },
  component: () => <Outlet />,
});
```

**Routes under `_admin/`:**

```text
src/routes/_authed/_admin/
├── users/
│   ├── index.tsx         → Admin only
│   └── new.tsx           → Admin only
└── settings.tsx          → Admin only
```

### Individual Route Permission Check

```tsx
// src/routes/_authed/accommodations/$id.edit.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth } from '@clerk/tanstack-react-start/server';

export const Route = createFileRoute('/_authed/accommodations/$id/edit')({
  beforeLoad: async () => {
    const { userId, sessionClaims } = await getAuth();
    const userRole = sessionClaims?.role as string;

    if (!userId) {
      throw redirect({ to: '/auth/signin' });
    }

    // Check if user has edit permission
    const canEdit = ['admin', 'manager', 'editor'].includes(userRole);

    if (!canEdit) {
      throw redirect({
        to: '/accommodations/$id',
        params: { id: window.location.pathname.split('/')[2] },
        search: {
          error: 'You do not have permission to edit',
        },
      });
    }
  },
  component: EditAccommodationPage,
});
```

---

## 🌐 API Route Protection

### Server Function with Permission Check

```tsx
// src/features/accommodations/api.ts
import { createServerFn } from '@tanstack/react-start';
import { getAuth } from '@clerk/tanstack-react-start/server';
import { getWebRequest } from '@tanstack/react-start/server';

export const deleteAccommodation = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const request = getWebRequest();
    const { userId, sessionClaims } = await getAuth(request);

    if (!userId) {
      throw new Error('Unauthorized');
    }

    const userRole = sessionClaims?.role as string;
    const canDelete = ['admin', 'manager'].includes(userRole);

    if (!canDelete) {
      throw new Error('Insufficient permissions');
    }

    // Delete accommodation
    await db.accommodations.delete({ where: { id } });

    return { success: true };
  });
```

### Permission Middleware

```tsx
// src/lib/permission-middleware.ts
import { getAuth } from '@clerk/tanstack-react-start/server';
import { getWebRequest } from '@tanstack/react-start/server';

type Role = 'admin' | 'manager' | 'editor' | 'viewer';

export async function requireRole(requiredRole: Role) {
  const request = getWebRequest();
  const { userId, sessionClaims } = await getAuth(request);

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const userRole = sessionClaims?.role as Role;
  const roleHierarchy: Record<Role, number> = {
    admin: 4,
    manager: 3,
    editor: 2,
    viewer: 1,
  };

  if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
    throw new Error('Insufficient permissions');
  }

  return { userId, userRole };
}

export async function requirePermission(permission: string) {
  const request = getWebRequest();
  const { userId, sessionClaims } = await getAuth(request);

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const userRole = sessionClaims?.role as Role;
  const rolePermissions: Record<Role, string[]> = {
    admin: ['*'], // All permissions
    manager: ['accommodations:*', 'analytics:read'],
    editor: ['accommodations:read', 'accommodations:create', 'accommodations:edit'],
    viewer: ['accommodations:read'],
  };

  const permissions = rolePermissions[userRole] || [];
  const hasPermission =
    permissions.includes('*') ||
    permissions.includes(permission) ||
    permissions.some((p) => p.endsWith(':*') && permission.startsWith(p.split(':')[0]));

  if (!hasPermission) {
    throw new Error('Insufficient permissions');
  }

  return { userId, userRole };
}
```

**Usage:**

```tsx
export const updateSettings = createServerFn({ method: 'POST' })
  .validator((data: SettingsData) => data)
  .handler(async ({ data }) => {
    // Require admin role
    await requireRole('admin');

    // Or require specific permission
    await requirePermission('settings:edit');

    // Update settings
    return await db.settings.update(data);
  });
```

---

## 💡 Best Practices

### Always Check Permissions on Server

**✅ DO:**

```tsx
// Server-side check
export const deleteUser = createServerFn({ method: 'POST' })
  .handler(async ({ data: userId }) => {
    await requireRole('admin');
    return await db.users.delete(userId);
  });
```

**❌ DON'T:**

```tsx
// Client-side only (insecure!)
export function DeleteButton({ userId }) {
  const { hasRole } = usePermissions();

  const handleDelete = async () => {
    if (hasRole('admin')) {
      await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    }
  };
}
```

### Use Permission Guards for UI

**✅ DO:**

```tsx
export function ActionBar() {
  return (
    <div>
      <PermissionGuard permission="accommodations:create">
        <CreateButton />
      </PermissionGuard>

      <PermissionGuard permission="accommodations:edit">
        <EditButton />
      </PermissionGuard>
    </div>
  );
}
```

### Fail Securely

**✅ DO:**

```tsx
export function AdminPanel() {
  const { hasRole } = usePermissions();

  // Deny by default
  if (!hasRole('admin')) {
    return <AccessDenied />;
  }

  return <AdminContent />;
}
```

**❌ DON'T:**

```tsx
// Never allow by default
export function AdminPanel() {
  const { hasRole } = usePermissions();

  if (hasRole('admin')) {
    return <AdminContent />;
  }

  // This would show admin content if hook fails!
  return <div>Loading...</div>;
}
```

### Show Clear Error Messages

**✅ DO:**

```tsx
export function ProtectedAction() {
  const { can } = usePermissions();

  if (!can('accommodations:delete')) {
    return (
      <div className="text-sm text-gray-500">
        You need 'manager' role or higher to delete accommodations
      </div>
    );
  }

  return <DeleteButton />;
}
```

---

## 🐛 Common Issues

### Issue: "Permission check always returns false"

**Symptom:** All permission checks fail even for admins

**Cause:** Role not set in Clerk session claims

**Solution:**

1. Configure session claims in Clerk Dashboard
2. Add role to user metadata:

```typescript
// Set role when creating user
await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: {
    role: 'admin',
  },
});
```

3. Configure Clerk to include role in session:

```json
// Clerk Dashboard → Sessions → Customize session token
{
  "role": "{{user.public_metadata.role}}"
}
```

### Issue: "Permissions work in dev but not production"

**Symptom:** Permission checks fail in production deployment

**Cause:** Environment variables not set correctly

**Solution:**

```bash
# Verify environment variables in production
CLERK_SECRET_KEY=sk_live_...  # Not sk_test_!
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...  # Not pk_test_!
```

### Issue: "UI shows button but API rejects action"

**Symptom:** User can see action button but gets error when clicking

**Cause:** Client and server permission checks out of sync

**Solution:**

```tsx
// Keep permission logic consistent
const rolePermissions = {
  admin: ['accommodations:delete'],
  manager: ['accommodations:delete'],
  editor: [],
  viewer: [],
};

// Use same logic on client and server
export function usePermissions() {
  const { sessionClaims } = useAuth();
  const role = sessionClaims?.role;
  const can = (permission: string) =>
    rolePermissions[role]?.includes(permission) ?? false;
  return { can };
}
```

---

## 📖 Additional Resources

### Official Documentation

- **[Clerk Roles & Permissions](https://clerk.com/docs/organizations/roles-permissions)** - Official guide
- **[Clerk Organizations](https://clerk.com/docs/organizations/overview)** - Organization-based permissions
- **[Session Claims](https://clerk.com/docs/backend-requests/making/custom-session-token)** - Custom session data

### Internal Resources

- **[Authentication Guide](./authentication.md)** - Auth basics
- **[Protected Routes Guide](./protected-routes.md)** - Route protection
- **[Architecture Overview](../architecture.md)** - System design

### Examples

See working examples in:

- `apps/admin/src/hooks/use-permissions.ts` - Permission hooks
- `apps/admin/src/routes/_authed/_admin.tsx` - Admin-only routes
- `apps/admin/src/components/PermissionGuard.tsx` - Permission guards

---

⬅️ Back to [Development Documentation](./README.md)
