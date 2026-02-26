FROM node:18-alpine

WORKDIR /app

# 複製套件設定檔
COPY package.json pnpm-lock.yaml ./

# 安裝 pnpm
RUN npm install -g pnpm

# 安裝相依套件
RUN pnpm install --frozen-lockfile

# 複製專案檔案
COPY . .

# 建置應用程式
RUN pnpm run build

# 設定環境變數
ENV NODE_ENV=production

# 開放埠號
EXPOSE 3000

# 啟動應用程式
CMD ["node", "build/index.js"]
