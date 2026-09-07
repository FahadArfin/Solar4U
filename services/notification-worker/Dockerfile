FROM node:22-alpine
WORKDIR /app
COPY services/notification-worker ./notification-worker
COPY services/shared ./shared
WORKDIR /app/notification-worker
ENV PORT=4003
EXPOSE 4003
CMD ["node","server.mjs"]
