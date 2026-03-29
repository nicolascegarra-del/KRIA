FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Production build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
# Copiamos la plantilla (NO el conf final) para que envsubst
# pueda sustituir ${NGINX_HOSTS} en tiempo de arranque.
COPY nginx-spa.conf /etc/nginx/conf.d/nginx-spa.conf.template
RUN rm -f /etc/nginx/conf.d/default.conf
# Valor por defecto seguro (build local/CI sin NGINX_HOSTS definido)
ENV NGINX_HOSTS="localhost"
EXPOSE 80
# envsubst solo sustituye ${NGINX_HOSTS}; el resto de variables nginx
# ($host, $uri, $remote_addr…) quedan intactas al usar comillas simples.
CMD ["/bin/sh", "-c", "envsubst '${NGINX_HOSTS}' < /etc/nginx/conf.d/nginx-spa.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
