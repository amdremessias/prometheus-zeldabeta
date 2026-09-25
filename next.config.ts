import type { NextConfig } from "next";

const securityHeaders = [
    // Evita MIME sniffing.
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Evita clickjacking.
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    // Política de referrer restritiva.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Permissions policy (reduz superfície de APIs do navegador).
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

const nextConfig: NextConfig = {
    output: "standalone",
    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
