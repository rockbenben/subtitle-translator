/* eslint-disable @typescript-eslint/no-require-imports */
// 单语言构建：产出只含一种语言的静态站。用法：node scripts/buildWithLang.js <lang>
//
// 语言集合由 src/i18n/locales.ts 读 NEXT_PUBLIC_BUILD_LOCALE 决定，本脚本只负责
// 把这个环境变量传给构建命令 —— 不改任何源码、没有备份/还原、没有 Ctrl+C 残留
// 半改状态的风险。
//
// ⚠ 这里【曾经】是一百多行的「正则改写源码 → 构建 → 还原」。那套办法的失败模式是
//   静默的：组件一重构，正则就匹配不上，构建照样"成功"而改写落空。实际踩过两次
//   （语言切换器的 <Dropdown open={langOpen}>、page.tsx 的 redirect("…")），
//   还额外踩了一次「替换恒等被误判成失败」。根因是拿正则当配置接口 —— 现在
//   locale 集合是可注入的配置，脚本就不需要认识源码长什么样了。
// ⚠ 语言合法性由 locales.ts 在模块加载时校验（next dev 也吃这条），不在这里重复。
// ⚠ 跑的是 `npm run build` 而不是 `next build`：直接 execSync("next build") 时
//   node_modules/.bin 不在 PATH 上（只有经包管理器运行才会加），实测报
//   「'next' 不是内部或外部命令」—— 按本文件文档的用法根本跑不起来。
//   走包管理器还顺带把 pre/postbuild 一并跑上（本仓的 next-sitemap），与普通构建一致。
// ⚠ 用 npm 而不是 yarn：本仓自己用 Yarn 1，但这个脚本可能被任何人以任何方式调用，
//   而 npm 随 Node 一起装、一定在；`npm run` 只是执行 package.json 的 script，
//   不装依赖、不读 lockfile，谁装的 node_modules 都不影响。
// ⚠ 已知且【刻意不修】：next-sitemap.config.js 的 locales 取自 messages/*.json 而非
//   routing.locales，所以单语言构建的 sitemap 里 <loc> 只有该语言（对），hreflang
//   备用链接却仍列全 18 个。单语言产物的用途是离线/内网包，不发 sitemap；真要用于
//   公网部署再改那份配置。
const { execSync } = require("child_process");
const path = require("path");

const lang = process.argv[2] || "en";
const root = path.join(__dirname, "..");
const env = { ...process.env, NEXT_PUBLIC_BUILD_LOCALE: lang };

const run = (cmd) => {
  try {
    execSync(cmd, { stdio: "inherit", cwd: root, env });
  } catch (error) {
    // stdio 已经 inherit —— 子进程自己的报错（含 routing.ts 对未知 locale 抛的那条）
    // 就在上面。execSync 默认再抛一个「Command failed: npm run build」+ Node 调用栈
    // + `stdout: null`，只会把真正的原因埋掉，实测排查时确实被它误导过。
    // 这里安静地按子进程的退出码退出。
    process.exit(typeof error.status === "number" ? error.status : 1);
  }
};

run("npm run build");
