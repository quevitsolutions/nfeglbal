# AIPCore Backend Dockerfile
FROM node:20-alpine
RUN apk add --no-cache curl git

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
