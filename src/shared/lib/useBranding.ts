'use client';

import { useDataStore } from '@/store/userStore';
import { customBranding, defaultLogo, defaultSelo } from './branding';

// Retorna as URLs de logo/selo considerando a seleção feita em Configurações
// (que pode apontar para uma imagem já existente na pasta public, evitando
// problemas de permissão de escrita no servidor).
export function useBrandingUrls() {
    const branding = useDataStore((s) => s.config?.branding);
    return {
        logo: branding?.logo || customBranding.logo,
        selo: branding?.selo || customBranding.selo,
        defaultLogo,
        defaultSelo,
    };
}
