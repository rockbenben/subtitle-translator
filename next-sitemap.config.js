/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || "https://tools.newzone.top",
  generateRobotsTxt: true, // 索引站点地图 robots.txt
  outDir: "out", // 站点地图输出目录
  // sitemapSize: 7000, // 大型站点可拆分成多个 sitemap 文件
  // 将其他站点地图添加到 robots.txt 主机条目的选项
  /* robotsTxtOptions: {
    additionalSitemaps: ["https://example.com/server-sitemap.xml"],
  }, */
};
