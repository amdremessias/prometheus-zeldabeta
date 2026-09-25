'use client';
import { useState } from 'react';
import { useBrandingUrls } from '@/shared/lib/useBranding';

// Imagem de marca com fallback: tenta o logo personalizado (customSrc ou o
// selecionado em Configurações quando `kind` é informado) e, se ele não existir
// (404) ou falhar, volta para o padrão (fallback).
export function BrandingImage({
    customSrc,
    fallback,
    alt,
    className,
    cacheBust,
    kind,
}: {
    customSrc?: string;
    fallback: string;
    alt: string;
    className?: string;
    cacheBust?: number;
    kind?: 'logo' | 'selo';
}) {
    const branding = useBrandingUrls();
    const resolved = kind === 'logo' ? branding.logo : kind === 'selo' ? branding.selo : customSrc || fallback;
    const [current, setCurrent] = useState(cacheBust ? `${resolved}?v=${cacheBust}` : resolved);

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={current}
            alt={alt}
            className={className}
            onError={() => {
                if (current !== fallback) setCurrent(fallback);
            }}
        />
    );
}
