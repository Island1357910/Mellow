FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p /data && chown node:node /data
COPY server.mjs content.mjs upstream.mjs play-privacy.mjs schema.sql ./
USER node
EXPOSE 8787
CMD ["node", "server.mjs"]
