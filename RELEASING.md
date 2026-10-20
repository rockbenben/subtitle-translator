# 发布手册(桌面端)

发布走 GitHub Actions(`.github/workflows/desktop-build.yml`),产物是一条 release;
流水线最后那条 `publish` job 会把它发布出去,并显式把 `releases/latest` 指到它
(updater 解析的是 `releases/latest`,不发布它就看不到新版本)。
**发版这一步没有人工环节。**

## 步骤

1. **改版本号**:只改 `package.json` 的 `version`(单一事实源)。
   CI 构建时会跑 `yarn update-version` 把它写进 `src-tauri/tauri.conf.json`,
   所以 `tauri.conf.json` 里的 version 不用手改、也不必提交。
2. **推分支**:push 到 `main` / `feat/**`(或开 PR)会触发 `quality` 闸:
   `lint` / `typecheck` / 三个跨仓契约 check / `cargo test` / `cargo clippy -D warnings`。
   必须全绿再发。
3. **打 tag**:`git tag vX.Y.Z && git push origin vX.Y.Z`。
   tag **必须**等于 `v` + package.json version,流水线有强校验,不一致直接红。
4. **等四个平台矩阵跑完**,会得到一条 release:
   - NSIS setup(`SubtitleTranslator_X.Y.Z_x64_setup.exe`)、MSI、
     macOS 两套 `.app.tar.gz`、Linux AppImage,全部带 `.sig`;
   - `latest.json`(updater 清单);
   - 便携版 `SubtitleTranslator_X.Y.Z_x64_portable.exe`(单独挂上去,**不自更新**)。
5. **`publish` job 接手**:矩阵跑完后它把那条 release 发布出去,并一次 PATCH 带上
   `draft=false` 与 `make_latest=true`,然后**自己查 API 确认** `releases/latest`
   指着这个 tag——指错就让这一趟红。

   为什么必须显式带 `make_latest`:草稿转成已发布时,GitHub **不会**重算
   `releases/latest` 指向谁——2026-10-20 在 rclone-deck 上撞到过一次:release 已经是
   `draft=false`、`prerelease=false`、`published_at` 也填上了,`releases/latest` 却仍返回
   旧版本,于是端点 `releases/latest/download/latest.json` 直接 404(旧 release 里根本没有
   `latest.json`)。所以判据是**看 API 指到谁**,不是看 release 的字段。

   CDN 那层重定向会再滞后几分钟,属正常——流水线判的是 API。

6. **客户端这就开始收到更新了**:启动检查 / 24h 轮询时,updater 会拿到新版本。

## 更新链路须知

- 端点:`releases/latest/download/latest.json`;安装包用 minisign 签名,
  私钥在 `TAURI_SIGNING_PRIVATE_KEY` secret,公钥烘焙在 `tauri.conf.json`。
- 更新流程是 check → 弹窗 → **用户确认后才下载** → 安装重启。Esc / 遮罩关闭
  不等于跳过,只有「Skip This Version」按钮会永久静音该版本。
- **macOS 未签名、未公证**:dmg/app 只能手动下载、右键打开,更新体验不保证。
- **Linux 只有 AppImage**,更新支持受限。
- 已 publish 的 tag 重跑流水线前要先删掉对应 release(tauri-action v1 的
  draft 匹配规则,见工作流头注释)。

## 用户报 bug 时要的日志

release 构建的日志(Info 级及以上)在:

- Windows:`%LOCALAPPDATA%\com.rockbenben.subtitletranslator\logs\`
- macOS:`~/Library/Logs/com.rockbenben.subtitletranslator/`
- Linux:`~/.config/com.rockbenben.subtitletranslator/logs/`

导出兜底路径(目录不可写、候选名占满、下载失败)的 warn/error 都在这里。
