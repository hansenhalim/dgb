#!/bin/bash

cd /var/www/html && mkdir -p storage/framework/{sessions,views,cache}
cd /var/www/html && php artisan storage:link

cd /var/www/html && php artisan migrate --force

cd /var/www/html && php artisan optimize
cd /var/www/html && php artisan filament:optimize

exec "$@"