FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/geo/package.json packages/geo/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace", "@pathbadger/web", "--", "--host", "0.0.0.0"]
