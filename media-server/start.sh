#!/bin/sh
set -e

# BACKEND_INTERNAL_URL: URL privada del backend dentro de Railway, por http
#   (nginx-rtmp no habla https), ej: http://punto-lovera.railway.internal:4000
# RTMP_AUTH_SECRET: el mismo valor que en el backend; nginx lo manda al
#   pedirle al backend que valide la clave de transmisión.
: "${BACKEND_INTERNAL_URL:?Falta la variable BACKEND_INTERNAL_URL}"
: "${RTMP_AUTH_SECRET:?Falta la variable RTMP_AUTH_SECRET}"

# Sin espacios ni saltos de línea (en el panel de Railway es fácil pegarlos)
RTMP_AUTH_SECRET=$(printf '%s' "$RTMP_AUTH_SECRET" | tr -d ' \r\n\t')
BACKEND_INTERNAL_URL=$(printf '%s' "$BACKEND_INTERNAL_URL" | tr -d ' \r\n\t' | sed 's#/*$##')

# DNS del contenedor (en Railway resuelve los *.railway.internal). nginx
# pide las IPv6 entre corchetes.
DNS_RESOLVER=$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)
DNS_RESOLVER=${DNS_RESOLVER:-127.0.0.11}
case "$DNS_RESOLVER" in
  *:*) DNS_RESOLVER="[$DNS_RESOLVER]" ;;
esac
export RTMP_AUTH_SECRET BACKEND_INTERNAL_URL DNS_RESOLVER

# Solo se reemplazan estas variables (el resto de los $ son de nginx)
envsubst '${BACKEND_INTERNAL_URL} ${RTMP_AUTH_SECRET} ${DNS_RESOLVER}' \
  < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

nginx -t
echo "Servidor de video listo: RTMP en 1935, HLS en 8080 (DNS $DNS_RESOLVER)"
exec nginx -g 'daemon off;'
