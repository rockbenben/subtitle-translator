# 基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制项目中的 package.json 和 yarn.lock 到工作目录中
COPY package.json yarn.lock ./

# 安装依赖，并清理缓存
RUN yarn install --frozen-lockfile --network-timeout 100000 && \
    yarn add -D wait-on && \
    yarn cache clean

# 复制项目源代码到工作目录
COPY . .

# 设置环境变量
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# 暴露端口 3000
EXPOSE 3000

# 预热路由：后台启动 dev server，预热所有语言路由
RUN yarn dev & \
    NEXT_PID=$! && \
    yarn wait-on http://localhost:3000 && \
    for lang in en zh zh-hant pt it de ru es fr ja ko hi ar bn; do \
    echo "Warming up /$lang"; \
    wget -qO- http://localhost:3000/$lang > /dev/null; \
    done && \
    kill $NEXT_PID

# 最终命令：再次启动开发服务器
CMD ["yarn", "dev"]

# 容器构建&运行命令
# docker build -t subtitle-translator .
# docker run -d -p 3000:3000 --name subtitle-translator subtitle-translator