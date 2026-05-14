FROM node:24-alpine

WORKDIR /app

COPY services/tileserver/package*.json ./

RUN npm ci --ignore-scripts

COPY services/tileserver ./

EXPOSE 8080

CMD ["npm", "run", "dev"]
