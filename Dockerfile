# 基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制项目中的 package.json 和 yarn.lock 到工作目录中
COPY package.json yarn.lock ./

# 安装依赖，并清理缓存
RUN yarn install --frozen-lockfile --network-timeout 100000 && \
    yarn cache clean

# 复制项目源代码到工作目录
COPY . .

# 设置环境变量
ENV NODE_ENV=development

# 暴露端口 3000
EXPOSE 3000

# 启动开发服务器，以支持API
CMD ["yarn", "dev"]

# 容器构建&运行命令
# docker build -t subtitle-translator .
# docker run -d -p 3000:3000 --name subtitle-translator subtitle-translator