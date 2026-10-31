FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY data/countries.json ./data/countries.json
ENV HOST=0.0.0.0 DATABASE_PATH=/data/stats.sqlite
VOLUME /data
USER node
EXPOSE 8787
CMD ["node", "src/index.mjs"]
