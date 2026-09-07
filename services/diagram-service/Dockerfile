FROM node:22-alpine
WORKDIR /app
COPY services/diagram-service ./diagram-service
COPY services/shared ./shared
WORKDIR /app/diagram-service
ENV PORT=4002
EXPOSE 4002
CMD ["node","server.mjs"]
