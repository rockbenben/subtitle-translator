const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// 从命令行参数中获取目标语言，默认 "en"
const lang = process.argv[2] || "en";

// 定义需要修改的文件路径
const routingPath = path.join(__dirname, "..", "src", "i18n", "routing.ts");
const pagePath = path.join(__dirname, "..", "src", "app", "page.tsx");
const notFoundPath = path.join(__dirname, "..", "src", "app", "not-found.tsx");
const navigationPath = path.join(__dirname, "..", "src", "app", "ui", "navigation", "Navigation.tsx");

// 备份原始内容
const backup = {
  routing: fs.readFileSync(routingPath, "utf8"),
  page: fs.readFileSync(pagePath, "utf8"),
  notFound: fs.readFileSync(notFoundPath, "utf8"),
  navigation: fs.readFileSync(navigationPath, "utf8"),
};

let buildError = null;

try {
  // 更新 src/i18n/routing.ts 文件
  let routingContent = backup.routing;
  routingContent = routingContent.replace(/locales:\s*\[[^\]]*\]/, `locales: ["${lang}"]`);
  routingContent = routingContent.replace(/defaultLocale:\s*".*?"/, `defaultLocale: "${lang}"`);
  fs.writeFileSync(routingPath, routingContent, "utf8");

  // 辅助函数：更新文件中的 redirect 调用
  const updateRedirect = (filePath) => {
    let content = fs.readFileSync(filePath, "utf8");
    content = content.replace(/redirect\(".*?"\)/g, `redirect("/${lang}")`);
    fs.writeFileSync(filePath, content, "utf8");
  };

  // 更新 src/app/page.tsx 和 src/app/not-found.tsx 文件
  updateRedirect(pagePath);
  updateRedirect(notFoundPath);

  // 修改 Navigation 文件：隐藏语言切换栏
  let navigationContent = backup.navigation;
  // 匹配并删除语言切换器的完整 Dropdown 组件块
  // 从 <Dropdown open={langOpen} 到对应的 </Dropdown> 结束
  navigationContent = navigationContent.replace(/<Dropdown\s+open=\{langOpen\}[\s\S]*?<\/Dropdown>/, "");
  fs.writeFileSync(navigationPath, navigationContent, "utf8");

  console.log(`Temp update done (临时更新完成): using language "${lang}" and hide language switch bar (使用语言 "${lang}" 并隐藏语言切换栏)`);

  // 执行构建命令（调用 Next.js 的构建命令）
  execSync("next build", { stdio: "inherit" });
} catch (error) {
  console.error("Build error occurred / 构建错误发生：", error);
  buildError = error; // 记录错误但不立即退出
} finally {
  // 构建完成后无论如何还原所有文件
  fs.writeFileSync(routingPath, backup.routing, "utf8");
  fs.writeFileSync(pagePath, backup.page, "utf8");
  fs.writeFileSync(notFoundPath, backup.notFound, "utf8");
  fs.writeFileSync(navigationPath, backup.navigation, "utf8");
  console.log("Files restored (文件已还原到原始状态)");

  // 如果之前有错误，则退出进程
  if (buildError) {
    process.exit(1);
  }
}
