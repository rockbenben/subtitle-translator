#!/bin/sh

# 启动 dev server 到后台
yarn dev &

DEV_PID=$!

# 等待服务就绪
npx wait-on http://localhost:3000

# 稍作延迟，确保稳定
sleep 2

# 路由语言列表
langs="en zh zh-hant pt it de ru es fr ja ko hi ar bn"

for lang in $langs; do
  echo "Warming up /$lang..."
  curl -s http://localhost:3000/$lang > /dev/null || echo "Failed warming $lang"
done

# 保持容器运行
wait $DEV_PID
