# 桌面端安全配置说明

记录 `tauri.conf.json` / `capabilities/default.json` 里非显而易见的取舍。
改安全相关配置前先读这份。

## CSP(`app.security.csp`)

生产环境有一条严格 CSP,dev 为 `null`(HMR 需要 `unsafe-eval` / `ws:`,
开发机是可信环境)。

- **`script-src 'self'`,没有 `unsafe-inline`**:tauri 在编译期
  (`generate_context!` → codegen)给每个预渲染 HTML 里的内联 `<script>`
  算 SHA-256,自动加进【该页】的 script-src;tauri 自己的 IPC 引导脚本由
  WebView 宿主注入,不受 CSP 约束。⚠️ 这只覆盖**构建时**的静态 HTML,
  任何运行时往 document 里插内联 `<script>` 的做法都会被拦 —— 目前
  React/Next/antd 都不这么干(antd cssinjs 只插 `<style>`)。
- **`style-src` 保留 `'unsafe-inline'`**:antd cssinjs 与 rc 组件在运行时
  注入 `<style>`,哈希是构建期算的,管不到运行时。
- **`connect-src` 放开任意 `http(s)`**:本应用的全部用途就是把翻译请求发往
  用户自填的端点 —— 本机运行时(`http://127.0.0.1:xxxx`)、局域网网关、
  各家云 API。收紧到域名白名单等于废掉自定义 provider。`ipc:` /
  `http(s)://ipc.localhost` 是 tauri 自己的 IPC 通道(Windows 走 http)。
- `img` 放开 `data:`/`blob:`(粘贴与预览),`font` 放开 `data:`;
  `object-src 'none'`、`base-uri 'self'`、`form-action 'self'`、
  `frame-ancestors 'none'` 是常规收紧。
- **配置文件本身必须是严格 JSON**(tauri-build 按 JSON 解析,
  `config-json5` feature 默认没开),理由写这里而不是写成注释。

## `freezePrototype: true`

冻结内置原型,挡一类原型污染利用链。React 19 / antd 6 均不修改原型,
无兼容性代价。

## capabilities 最小权限(`capabilities/default.json`)

- `opener:default` 被拆成 `allow-open-url` + `allow-default-urls`:
  外链拦截器只调 `openUrl`(scheme 限 http/https/mailto/tel);
  default 集合里的 `reveal-item-in-dir` 没有调用点,不收。
- `updater:default` 被拆成 `check` / `download` / `install`:
  前端流程是 check → 弹窗 → 用户确认 → download → install,合批的
  `download-and-install` 没有调用点。
- 应用自定义命令(导出目录四个)不需要 capability:只有插件命令需要。

## 主框架导航白名单(`on_navigation` in src/lib.rs)

渲染内容无法把整个窗口导航去外部站点:只放行 tauri 应用源、dev 时的
localhost、以及 blob: 下载。外链统一在 JS 捕获阶段(`TauriIntegration`)
交给系统浏览器。

## 导出直写命令(`write_export_file`)

直达文件系统的 IPC 面,校验:文件名必须是单一路径段(拒穿越 / 盘符 /
控制字符 / Windows 保留设备名),同名一律让路,失败删半成品。
细节与 Web 契约见 src/lib.rs 文件头注释。
