FROM unit:php8.4

WORKDIR /var/www/html

COPY docker/config.json docker/entrypoint.sh /docker-entrypoint.d/

RUN chmod +x /docker-entrypoint.d/entrypoint.sh

RUN apt-get update && apt-get install -y \
    libicu-dev \
    libpq-dev \
    libzip-dev \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install -j$(nproc) \
    intl \
    pdo_pgsql \
    zip

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY --chown=unit:unit composer.json composer.lock ./

RUN composer install \
    --no-ansi \
    --no-dev \
    --no-interaction \
    --no-plugins \
    --no-progress \
    --no-scripts

COPY --chown=unit:unit . .

RUN php artisan optimize && php artisan filament:optimize

EXPOSE 80