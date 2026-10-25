FROM node:22-bookworm-slim

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3002/api
ARG NEXT_PUBLIC_WS_URL=http://localhost:3002
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]
