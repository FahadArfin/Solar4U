FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

FROM base AS dev
ENV WRANGLER_LOG_PATH=.wrangler/wrangler.log
EXPOSE 3000
CMD ["npm","run","dev","--","--host","0.0.0.0"]

FROM base AS build
RUN npm run build

FROM build AS local
ENV WRANGLER_LOG_PATH=.wrangler/wrangler.log
EXPOSE 3000
CMD ["npm","run","start","--","--host","0.0.0.0"]
