import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 与 tsconfig.json 的 paths 保持一致:vitest 不读 tsconfig 的别名,
// 缺了这条 `@/app/utils` 之类的导入会在收集阶段直接解析失败。
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
