FROM node:22-alpine

# Time zone data: the CSV dates are in America/Sao_Paulo
RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo

WORKDIR /app

# Dependencies first: this layer is cached while package*.json does not change
COPY package*.json ./
RUN npm ci

COPY . .

# Runs as the unprivileged "node" user that the image provides, not as root
USER node

EXPOSE 3000
CMD ["npm", "start"]