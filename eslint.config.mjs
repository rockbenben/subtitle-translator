import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Inline rule: files under src/app/components or src/app/hooks that call a
// React-style hook (identifier matching /^use[A-Z]/) must declare "use client"
// at the top. Missing the directive creates an ambiguous client boundary that
// can break client-side navigation under Turbopack's async chunk loading —
// see fix(translate) commit b13c98c7a for a real incident.
const requireUseClient = {
  meta: {
    type: "problem",
    docs: { description: "Files that call React hooks must declare 'use client'" },
    schema: [],
    messages: {
      missing:
        "File uses React hook '{{name}}' but lacks a top-of-file \"use client\" directive. Add `\"use client\";` as the first statement, or move the hook out of this file.",
    },
  },
  create(context) {
    const firstStmt = context.sourceCode.ast.body[0];
    const hasUseClient =
      firstStmt &&
      firstStmt.type === "ExpressionStatement" &&
      firstStmt.expression.type === "Literal" &&
      (firstStmt.expression.value === "use client" || firstStmt.expression.value === "use server");

    if (hasUseClient) return {};

    let reported = false;
    return {
      CallExpression(node) {
        if (reported) return;
        const callee = node.callee;
        let name = null;
        if (callee.type === "Identifier") name = callee.name;
        else if (callee.type === "MemberExpression" && callee.property.type === "Identifier") name = callee.property.name;
        if (name && /^use[A-Z]/.test(name)) {
          reported = true;
          context.report({ node: callee, messageId: "missing", data: { name } });
        }
      },
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/components/**/*.{ts,tsx}", "src/app/hooks/**/*.{ts,tsx}"],
    plugins: { "local-rsc": { rules: { "require-use-client": requireUseClient } } },
    rules: { "local-rsc/require-use-client": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 桌面分支的构建产物：Electron 打包出的 win-unpacked 里带着一整份 out/，
    // Tauri 的 target/ 里是 Rust 构建生成的 JS 与二进制资产。不忽略的话
    // `yarn lint` 会去 lint 它们（实测 text-diff 报 5091 条、subtitle-translator
    // 50 条 Parsing error），源码里真正的问题被淹掉，这道闸等于失效。
    // 两个目录都已被 .gitignore 覆盖，这里只是让 eslint 也别看。
    "dist-electron/**",
    "src-tauri/**",
  ]),
]);

export default eslintConfig;
