# Servidor de video para los remates en vivo.
#
# El martillero transmite desde OBS por RTMP (puerto 1935) y nginx-rtmp lo
# convierte a HLS (/hls/camera_<id>/index.m3u8, puerto 8080). El HLS NO se
# expone al público: lo sirve el backend por su proxy autenticado (JWT o
# pase de invitado). Basado en el nginx de rtsp-manager (repo de Francis).
FROM alpine:3.20

RUN apk add --no-cache nginx nginx-mod-rtmp gettext \
    && mkdir -p /tmp/hls /run/nginx /var/log/nginx \
    && chown -R nginx:nginx /tmp/hls

COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 1935 8080

CMD ["/start.sh"]
