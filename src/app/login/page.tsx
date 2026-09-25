import type { Metadata, Viewport } from 'next';
import LoginForm from './LoginForm';
import { brand, defaultLogo, defaultSelo } from '@/shared/lib/branding';
import { PublicBrandingImage } from '@/shared/components/PublicBrandingImage';

export const metadata: Metadata = {
    title: `Login | ${brand.name}`,
    description: brand.description,
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: brand.color,
};

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <PublicBrandingImage
                            kind="logo"
                            fallback={defaultLogo}
                            alt={brand.name}
                            className="h-20 w-20 object-contain"
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">{brand.name}</h1>
                    <p className="text-gray-600 mt-1">Acesse o sistema para continuar</p>
                </div>
                <LoginForm />
                <div className="mt-6 flex flex-col items-center text-center">
                    <PublicBrandingImage
                        kind="selo"
                        fallback={defaultSelo}
                        alt="Selo de Segurança do Sistema"
                        className="h-24 w-24 object-contain"
                    />
                    <footer className="pt-3 text-gray-500 text-xs">
                        <p>
                            © {new Date().getFullYear()} {brand.name}. {brand.footer}
                        </p>
                    </footer>
                </div>
            </div>
        </div>
    );
}