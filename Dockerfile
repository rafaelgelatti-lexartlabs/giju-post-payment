FROM node:22.12.0-alpine3.21

WORKDIR /app

COPY . .

RUN npm install

ENTRYPOINT ["npm", "run", "dev"]
