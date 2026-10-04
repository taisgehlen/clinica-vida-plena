FROM node:22-alpine

RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN mkdir -p /app/reports && chown node:node /app/reports

USER node

EXPOSE 3000
CMD ["npm", "start"]