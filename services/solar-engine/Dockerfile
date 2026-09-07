FROM node:22-alpine
WORKDIR /app
COPY services/solar-engine ./solar-engine
COPY services/shared ./shared
WORKDIR /app/solar-engine
ENV PORT=4001
EXPOSE 4001
CMD ["node","server.mjs"]
