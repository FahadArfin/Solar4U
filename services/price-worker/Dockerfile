FROM node:22-alpine
RUN apk add --no-cache p7zip
WORKDIR /app
COPY services/price-worker/package.json ./package.json
RUN npm install --omit=dev
COPY services/price-worker ./price-worker
COPY services/shared ./shared
WORKDIR /app/price-worker
ENV PORT=4004
EXPOSE 4004
CMD ["node","server.mjs"]
