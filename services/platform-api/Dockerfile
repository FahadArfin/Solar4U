FROM node:22-alpine
WORKDIR /app
COPY services/platform-api/package.json ./package.json
RUN npm install --omit=dev
COPY services/platform-api ./platform-api
COPY services/shared ./shared
COPY infra/postgres/002-community.sql ./platform-api/migrations/002-community.sql
COPY infra/postgres/003-community-public-numbers.sql ./platform-api/migrations/003-community-public-numbers.sql
WORKDIR /app/platform-api
ENV PORT=4000
EXPOSE 4000
CMD ["node","server.mjs"]
