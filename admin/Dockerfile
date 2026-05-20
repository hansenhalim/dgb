FROM dunglas/frankenphp

ARG APP_ENV=production

WORKDIR /var/www/html

RUN apt-get update && apt-get install -y \
    libicu-dev \
    libpq-dev \
    libzip-dev \
    && rm -rf /var/lib/apt/lists/*

RUN install-php-extensions \
    intl \
    pdo_pgsql \
    zip

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY composer.json composer.lock ./

RUN if [ "$APP_ENV" = "production" ]; then \
        composer install \
            --no-ansi \
            --no-dev \
            --no-interaction \
            --no-plugins \
            --no-progress \
            --no-scripts; \
    else \
        composer install \
            --no-ansi \
            --no-interaction \
            --no-plugins \
            --no-progress \
            --no-scripts; \
    fi

COPY . .

RUN if [ "$APP_ENV" = "production" ]; then \
        composer dump-autoload --no-dev --optimize; \
    else \
        composer dump-autoload --optimize; \
    fi

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

ENV SERVER_NAME=:80

ENTRYPOINT ["/docker-entrypoint.sh"]

EXPOSE 80
