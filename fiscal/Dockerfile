# Módulo Fiscal — esqueleto PHP (Apache), sem transmissão real à SEFAZ nesta fase.
# Exposições: GET /health e POST /emitir (stub). Substituir pela stack real com
# NFePHP (sped-nfe) em fase posterior, quando houver certificado digital.
FROM php:8.2-apache

# Instala extensões mínimas (sob demanda posteriormente para NFePHP: soap, openssl, dom, mbstring).
RUN docker-php-ext-install soap dom mbstring || true

COPY index.php /var/www/html/index.php

# Roteia todas as requisições para o index.php (aplicação de rota única).
RUN printf '%s\n' \
    '<IfModule mod_rewrite.c>' \
    '    RewriteEngine On' \
    '    RewriteCond %{REQUEST_FILENAME} !-f' \
    '    RewriteRule ^ /index.php [QSA,L]' \
    '</IfModule>' > /etc/apache2/conf-available/apache2.conf && \
    a2enmod rewrite || true

# Volume de armazenamento (XMLs simulados / futuros) é montado do compose.
VOLUME ["/var/www/html/storage"]

EXPOSE 80
