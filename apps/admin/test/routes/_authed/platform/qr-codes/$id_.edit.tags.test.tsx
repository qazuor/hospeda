// @vitest-environment jsdom
/**
 * HOS-2679 I2 — the QR edit page must never open its tag selection from a
 * stale or failed read, and must save tags as a diff.
 *
 * The form is mocked: what is asserted is WHEN it mounts, WITH WHICH tags, and
 * what the save sends.
 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const QR_ID = '550e8400-e29b-41d4-a716-446655440000';

const tagsQuery = vi.hoisted(() => ({
    current: {} as Record<string, unknown>
}));
const commitMutateAsync = vi.hoisted(() => vi.fn());
const updateMutateAsync = vi.hoisted(() => vi.fn());
const captured = vi.hoisted(() => ({
    props: undefined as
        | undefined
        | { tagIds: readonly string[]; onSubmit: (p: unknown) => Promise<void> }
}));

vi.mock('@tanstack/react-router', () => ({
    createFileRoute:
        (_path: string) =>
        <T extends Record<string, unknown>>(options: T) => ({
            options,
            useParams: () => ({ id: QR_ID })
        }),
    useNavigate: () => vi.fn()
}));
vi.mock('@/components/auth/RoutePermissionGuard', () => ({
    RoutePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock('@/features/qr-codes/components/QrCodeForm', () => ({
    QrCodeForm: (props: { tagIds: readonly string[]; onSubmit: (p: unknown) => Promise<void> }) => {
        captured.props = props;
        return <div data-testid="qr-form">{props.tagIds.join(',')}</div>;
    }
}));
vi.mock('@/features/qr-codes/hooks/useQrCodes', () => ({
    useQrCodeDetail: () => ({ data: { id: QR_ID }, isLoading: false }),
    useUpdateQrCode: () => ({ mutateAsync: updateMutateAsync, isPending: false })
}));
vi.mock('@/features/qr-codes/hooks/useQrCodeTags', () => ({
    useQrCodeTagsOf: () => tagsQuery.current,
    useCommitQrCodeTagEdit: () => ({ mutateAsync: commitMutateAsync, isPending: false })
}));

import * as mod from '../../../../../src/routes/_authed/platform/qr-codes/$id_.edit';

const Page = (mod.Route as unknown as { options: { component: () => ReactNode } }).options
    .component;

beforeEach(() => {
    captured.props = undefined;
    commitMutateAsync.mockReset();
    updateMutateAsync.mockReset();
});

describe('QR edit page — tags (HOS-2679 I2)', () => {
    it('does not open the form from cached data before the fresh read lands', () => {
        tagsQuery.current = {
            data: [{ id: 'stale' }],
            isSuccess: true,
            isError: false,
            isFetchedAfterMount: false
        };

        render(<Page />);

        expect(screen.queryByTestId('qr-form')).toBeNull();
    });

    it('blocks the form with an error when the tag read failed', () => {
        tagsQuery.current = {
            data: undefined,
            isSuccess: false,
            isError: true,
            isFetchedAfterMount: true
        };

        render(<Page />);

        expect(screen.queryByTestId('qr-form')).toBeNull();
        expect(screen.getByRole('alert')).toHaveTextContent('admin-qr-codes.tags.loadError');
    });

    it('opens with the fresh tags and saves them as a diff', async () => {
        tagsQuery.current = {
            data: [{ id: 'a' }, { id: 'b' }],
            isSuccess: true,
            isError: false,
            isFetchedAfterMount: true
        };

        render(<Page />);
        expect(screen.getByTestId('qr-form')).toHaveTextContent('a,b');
        await captured.props?.onSubmit({ label: 'x' });

        expect(commitMutateAsync).toHaveBeenCalledWith({
            id: QR_ID,
            before: ['a', 'b'],
            after: ['a', 'b']
        });
    });
});
