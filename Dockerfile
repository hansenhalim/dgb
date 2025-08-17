##############################################
#    _____ _______       _____ ______   __   #
#   / ____|__   __|/\   / ____|  ____| /_ |  #
#  | (___    | |  /  \ | |  __| |__     | |  #
#   \___ \   | | / /\ \| | |_ |  __|    | |  #
#   ____) |  | |/ ____ \ |__| | |____   | |  #
#  |_____/   |_/_/    \_\_____|______|  |_|  #
#                                            #
##############################################

FROM composer:2.2 AS build

WORKDIR /app

COPY composer.json composer.lock ./

RUN composer install \
    --ignore-platform-req=ext-exif \
    --ignore-platform-req=ext-intl \
    # --no-dev \
    --optimize-autoloader \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --no-scripts




################################################
#    _____ _______       _____ ______   ___    #
#   / ____|__   __|/\   / ____|  ____| |__ \   #
#  | (___    | |  /  \ | |  __| |__       ) |  #
#   \___ \   | | / /\ \| | |_ |  __|     / /   #
#   ____) |  | |/ ____ \ |__| | |____   / /_   #
#  |_____/   |_/_/    \_\_____|______| |____|  #
#                                              #
################################################

FROM unit:php8.4

WORKDIR /var/www/html

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libicu-dev \
    libhiredis-dev \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install \
    pdo_pgsql \
    intl \
    exif \
    opcache

RUN pecl install redis \
    && docker-php-ext-enable redis

COPY docker/php.ini /usr/local/etc/php/conf.d/99-custom.ini

COPY --from=build --chown=unit:unit /app/vendor ./vendor

COPY --chown=unit:unit . .

COPY docker/config.json docker/entrypoint.sh /docker-entrypoint.d/

RUN chmod +x /docker-entrypoint.d/entrypoint.sh
