# Stage 1: Build environment and Composer dependencies
FROM composer:2.2 as build

WORKDIR /app

COPY composer.json composer.lock ./

RUN composer install \
    # --no-dev \
    --optimize-autoloader \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --no-scripts

# Stage 2: Production environment
FROM unit:php8.4

WORKDIR /var/www/html

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install pdo_pgsql

COPY . .

COPY --from=build /app/vendor ./vendor

RUN chown -R unit:unit /var/www/html

COPY docker/config.json docker/entrypoint.sh /docker-entrypoint.d/

RUN chmod +x /docker-entrypoint.d/entrypoint.sh

EXPOSE 80
