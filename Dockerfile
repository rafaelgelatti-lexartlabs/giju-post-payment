FROM node:22.15.0-alpine

WORKDIR /app

COPY . .

RUN npm install

ENTRYPOINT ["npm", "run", "dev"]
