#!/bin/sh
set -e

# BACKEND_INTERNAL_URL: URL privada del backend dentro de Railway, por http
#   (nginx-rtmp no habla https), ej: http://punto-lovera.railway.internal:4000
# RTMP_AUTH_SECRET: el mismo valor que en el backend; nginx lo manda al
#   pedirle al backend que valide la clave de transmisión.
: "${BACKEND_INTERNAL_URL:?Falta la variable BACKEND_INTERNAL_URL}"
: "${RTMP_AUTH_SECRET:?Falta la variable RTMP_AUTH_SECRET}"

# Solo se reemplazan estas dos variables (el resto de los $ son de nginx)
envsubst '${BACKEND_INTERNAL_URL} ${RTMP_AUTH_SECRET}' \
  < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

nginx -t
echo "Servidor de video listo: RTMP en 1935, HLS en 8080"
exec nginx -g 'daemon off;'
