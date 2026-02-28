FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .

RUN DATABASE_URL="libsql://placeholder" DATABASE_AUTH_TOKEN="placeholder" pnpm run build

ENV NODE_ENV=production
ENV BODY_SIZE_LIMIT=52428800
EXPOSE 3000

CMD ["sh", "scripts/docker-start.sh"]
