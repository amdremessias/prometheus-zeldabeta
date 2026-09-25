import './globals.css';
import type { ReactNode, CSSProperties } from 'react';
import type { Metadata, Viewport } from 'next';
import { brand } from '@/shared/lib/branding';
import { ServiceWorkerRegister } from '@/shared/components/ServiceWorkerRegister';

export const metadata: Metadata = {
    title: { default: brand.name, template: `%s | ${brand.name}` },
    description: brand.description,
    manifest: '/manifest.webmanifest',
    icons: {
        icon: [{ url: brand.logo, type: 'image/svg+xml' }],
        apple: [{ url: '/apple-touch-icon.png' }],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: brand.name,
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: brand.color,
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="pt-BR" style={{ '--brand': brand.color } as CSSProperties} suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var t=localStorage.getItem('zpdv-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`,
                    }}
                />
            </head>
            <body>
                {children}
                <ServiceWorkerRegister />
            </body>
        </html>
    );
}
