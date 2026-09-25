// White label: identidade + tema configuráveis por variáveis de ambiente.
// Todas usam prefixo NEXT_PUBLIC_ para serem embutidas no build (e válidas no cliente).

export const brand = {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Zelda PDV',
    description:
        process.env.NEXT_PUBLIC_BRAND_DESCRIPTION ||
        'O sistema completo de PDV para o seu estabelecimento: venda rápida, fiado, delivery e relatórios.',
    logo: process.env.NEXT_PUBLIC_BRAND_LOGO || '/logo.svg',
    // Selo de segurança do sistema (exibido no login e na barra de navegação).
    selo: process.env.NEXT_PUBLIC_BRAND_SELO || '/csi2_selo_seguranca_transparente.png',
    // Cor primária em formato hex/rgb/oklch — aplicada em :root como --brand
    color: process.env.NEXT_PUBLIC_BRAND_COLOR || '#16a34a',
    footer: process.env.NEXT_PUBLIC_BRAND_FOOTER || 'Todos direitos reservados.',
};

// Caminhos dos logos personalizados (substituídos via upload em Configurações).
// Servidos por /api/branding/[type] (mais robusto que arquivos estáticos no standalone).
// O fallback para a imagem padrão é tratado no componente <BrandingImage />.
export const customBranding = {
    logo: '/api/branding/logo',
    selo: '/api/branding/selo',
};

export const defaultSelo = brand.selo;
export const defaultLogo = brand.logo;
