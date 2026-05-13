FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/geo/package.json packages/geo/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --ignore-scripts

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev", "--workspace", "@pathbadger/api"]
