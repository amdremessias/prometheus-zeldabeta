import type { Metadata } from 'next';
import AppRoot from '@/shared/components/AppRoot';
import AppRouter from '@/shared/components/AppRouter';
import { brand } from '@/shared/lib/branding';

export const metadata: Metadata = {
    title: brand.name,
    description: brand.description,
};

export default function RootPageDemo() {
    return (
        <AppRoot demo>
            <AppRouter />
        </AppRoot>
    );
}
