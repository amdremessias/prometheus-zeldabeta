'use client';

import { useEffect, useState } from 'react';
import { BrandingImage } from './BrandingImage';

// Igual a <BrandingImage kind=... />, mas busca a seleção diretamente do servidor
// via /api/branding/config. Útil em páginas públicas (ex.: login) onde o store
// do Zustand ainda não está hidratado.
export function PublicBrandingImage({
    kind,
    fallback,
    alt,
    className,
}: {
    kind: 'logo' | 'selo';
    fallback: string;
    alt: string;
    className?: string;
}) {
    const [src, setSrc] = useState<string | undefined>(undefined);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let active = true;
        fetch('/api/branding/config')
            .then((r) => (r.ok ? r.json() : Promise.resolve({})))
            .then((d) => {
                if (!active) return;
                setSrc(kind === 'logo' ? d.logo : d.selo);
                setLoaded(true);
            })
            .catch(() => active && setLoaded(true));
        return () => {
            active = false;
        };
    }, [kind]);

    return (
        <BrandingImage
            customSrc={src || fallback}
            fallback={fallback}
            alt={alt}
            className={className}
        />
    );
}
