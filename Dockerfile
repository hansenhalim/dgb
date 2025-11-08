FROM unit:php8.4

ARG APP_ENV=production

WORKDIR /var/www/html

RUN apt-get update && apt-get install -y \
    libicu-dev \
    libpq-dev \
    libzip-dev \
    libmagickwand-dev \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install -j$(nproc) \
    intl \
    pdo_pgsql \
    zip

RUN pecl install imagick \
    && docker-php-ext-enable imagick

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY --chown=unit:unit composer.json composer.lock ./

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

COPY --chown=unit:unit . .

RUN if [ "$APP_ENV" = "production" ]; then \
        composer dump-autoload --no-dev --optimize; \
    else \
        composer dump-autoload --optimize; \
    fi

COPY docker/config.json docker/entrypoint.sh /docker-entrypoint.d/

RUN chmod +x /docker-entrypoint.d/entrypoint.sh

EXPOSE 80