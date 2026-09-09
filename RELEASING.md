# 发布手册(桌面端)

发布走 GitHub Actions(`.github/workflows/desktop-build.yml`),产物是一个
**DRAFT** release;不手动 publish,任何已安装客户端都收不到更新
(updater 解析的是 `releases/latest`,draft 对它不可见)。

## 步骤

1. **改版本号**:只改 `package.json` 的 `version`(单一事实源)。
   CI 构建时会跑 `yarn update-version` 把它写进 `src-tauri/tauri.conf.json`,
   所以 `tauri.conf.json` 里的 version 不用手改、也不必提交。
2. **推分支**:push 到 `main` / `feat/**`(或开 PR)会触发 `quality` 闸:
   `lint` / `typecheck` / 两个跨仓契约 check / `cargo test` / `cargo clippy -D warnings`。
   必须全绿再发。
3. **打 tag**:`git tag vX.Y.Z && git push origin vX.Y.Z`。
   tag **必须**等于 `v` + package.json version,流水线有强校验,不一致直接红。
4. **等四个平台矩阵跑完**,会得到一个 draft release:
   - NSIS setup(`SubtitleTranslator_X.Y.Z_x64_setup.exe`)、MSI、
     macOS 两套 `.app.tar.gz`、Linux AppImage,全部带 `.sig`;
   - `latest.json`(updater 清单);
   - 便携版 `SubtitleTranslator_X.Y.Z_x64_portable.exe`(单独挂上去,**不自更新**)。
5. **在 GitHub 上检查 draft**:
   - `latest.json` 的 `windows-x86_64` 必须指向 **NSIS setup**
     (`updaterJsonPreferNsis: true`):已发布用户都是 NSIS 装的,喂 MSI 会装出
     第二份并列应用;
   - 资产齐全、版本号正确。
6. **Publish release**。这一步之后客户端才会在启动检查 / 24h 轮询时收到更新。

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
