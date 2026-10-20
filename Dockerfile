# ============ 构建阶段 ============
# --platform=$BUILDPLATFORM：把构建固定在 runner 的原生架构（amd64）上，只跑一次。
#
# 为什么必须固定：多架构构建下，arm64 会在 QEMU 用户态模拟里把 yarn install /
# yarn build 整个重跑一遍。这是流水线里最吃 CPU、syscall 和进程启动的一步
# （几百个包解包 link，外加原生包的 postinstall 要反复起 node 进程），
# 实测会从分钟级膨胀到小时级，甚至直接卡死。固定之后 arm64 只多出一个
# node:24-alpine 的 adduser/COPY，几秒钟的事。
#
# 前提是产物与 CPU 架构无关 —— 由 next.config.ts 的 outputFileTracingExcludes
# 排掉 sharp 的平台专属二进制来保证，并由下面的断言步骤强制校验。
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

WORKDIR /app

# yarn 缓存挂载。⚠️ 只在本地重复构建时有效 —— BuildKit 默认不会把 cache mount
# 保留进 GitHub Actions 缓存（官方原文：BuildKit doesn't preserve cache mounts in
# the GitHub Actions cache by default），所以 CI 上它既不会跨构建复用，单次构建里
# `yarn install` 又只跑一遍，等于空转，别指望它省下载。
# CI 里真正省掉整个 yarn install 的是 workflow 的 cache-from/cache-to: type=gha：
# 只要 package.json + yarn.lock 没变，这一层直接命中，根本不执行。
# 若确实要让 CI 也复用 yarn 缓存，得另接 reproducible-containers/buildkit-cache-dance。
ENV YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn

COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --network-timeout 100000

COPY . .

# Docker 构建：使用 standalone 模式，启用本地 API
ENV DOCKER_BUILD=true
ENV NEXT_PUBLIC_USE_LOCAL_API=true
ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn build

# 断言：standalone 产物必须存在，且不允许出现任何平台专属原生模块。
# 没有这一步，上面「产物与架构无关」的假设一旦失效（比如将来启用了
# next/image 优化、sharp 又被追踪进来），就会悄悄产出一个装着 amd64 二进制的
# arm64 镜像：构建全绿，运行时才炸。这里让它当场失败。
RUN if [ ! -d .next/standalone ]; then \
      echo "ERROR: .next/standalone 不存在 —— 构建未产出 standalone 产物。"; \
      exit 1; \
    fi; \
    if find .next/standalone -name '*.node' | grep -q .; then \
      echo "ERROR: .next/standalone 含平台专属原生模块，不能跨架构复用。"; \
      echo "请检查 next.config.ts 的 outputFileTracingExcludes。"; \
      find .next/standalone -name '*.node'; \
      exit 1; \
    fi

# ============ 运行阶段 ============
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

# 构建 & 运行命令:
# docker build -t subtitle-translator .
# docker run -d -p 3000:3000 --name subtitle-translator subtitle-translator
