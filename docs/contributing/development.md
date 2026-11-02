# 千机开发指南

项目包含 WebUI、桌面壳、独立 Web CLI 和共享构建工具。桌面源码位于 `packages/desktop/src/`，WebUI 进程由 `packages/web-host/` 管理。

## 环境

- Node.js 22–24 与 Bun。
- Rust 1.95.0 / Cargo：用于从仓库内源码快照编译千机后端。首次编译需要下载第三方 Cargo 依赖。
- 桌面调试需要 Electron 运行环境；WebUI 可独立启动。

```bash
bun install
node scripts/prepareQianjicore.js
bun run webui
```

默认访问 `http://127.0.0.1:25809`。终端输出首次登录信息，开发数据保存在 `~/.qianji-web-dev`。`bun run webui` 会重新构建前端；已完成构建时可使用 `bun run webui --no-build --no-open`。

桌面开发使用 `bun run start`。前后端共用统一协议，运行二进制为 `qianjicore`，内置引擎为 `qianjirs`。产品不支持旧名称别名或旧目录迁移。

## 后端源码维护

版本由根 `package.json` 的 `qianjicoreVersion` 与 `packages/web-host/assets/backend.json` 固定。源码和许可证随 `qianjicore-source.tar.gz` 提供。构建缓存默认位于 `~/.cache/qianji/backend/<SHA-256>/`，输出位于 `resources/bundled-qianjicore/<平台-架构>/`。

修改后端时，先解压维护源码，再运行 Cargo 检查、测试，最后重新生成源码与技能包：

```bash
node packages/shared-scripts/src/package-product-backend.js /path/to/QianjiCore
node packages/shared-scripts/src/prepare-product-resources.js /path/to/QianjiCore
node scripts/prepareQianjicore.js
```

跨平台构建需在目标系统执行，或指定经过产品清单校验的 `QIANJI_BACKEND_LOCAL_BUNDLE_DIR`。原始开源来源见[来源与许可证](../../packages/web-host/assets/SOURCES.md)。

## 验证

```bash
bun run lint:fix
bun run format
bunx tsc --noEmit
bun run i18n:types
node scripts/check-i18n.js
bun run test
bun run package
```

提交和 PR 遵循根目录 `CONTRIBUTING.md`。用户未明确要求时，AI 不执行提交、推送或发布。
