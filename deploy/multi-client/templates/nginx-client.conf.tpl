# Zelda PDV — reverse proxy do cliente: __CLIENT__.__DOMAIN__
# Arquivo GERADO pelo deploy/multi-client/add-client.sh. Não edite manualmente.
# Placeholders (substituídos via sed): __CLIENT__ __DOMAIN__ __APP_PORT__ __HTTP_PORT__ __HTTPS_PORT__

server {
    listen __HTTP_PORT__;
    listen [::]:__HTTP_PORT__;
    server_name __CLIENT__.__DOMAIN__;

    # HTTP -> HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen __HTTPS_PORT__ ssl;
    listen [::]:__HTTPS_PORT__ ssl;
    server_name __CLIENT__.__DOMAIN__;

    ssl_certificate     /etc/nginx/ssl/__DOMAIN__/wildcard.pem;
    ssl_certificate_key /etc/nginx/ssl/__DOMAIN__/wildcard-key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5:!3DES;
    ssl_prefer_server_ciphers off;

    # Sem HSTS: certificado wildcard autoassinado (lab interno). Ao usar
    # domínio público real, retire este comentário.
    # add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Imagens de produtos / fotos
    client_max_body_size 25m;

    # Headers de segurança
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:__APP_PORT__;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }
}