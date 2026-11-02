# 千机内置资源

`backend.json` 定义千机后端版本、源码校验和、编译工具链和协议名称。`qianjicore-source.tar.gz` 是已统一命名的后端及 Agent 引擎源码快照，包含构建所需文件、内置资源和许可证。打包流程从该快照编译，不下载原产品二进制。

```bash
node scripts/prepareQianjicore.js
```

首次编译需要 Rust 1.95.0 和构建依赖，Cargo 会下载第三方依赖。构建目录默认是 `~/.cache/qianji/backend/<源码校验和>/`；可用 `QIANJI_BACKEND_BUILD_DIR` 指定。为控制本地构建占用，默认使用关闭调试信息的 dev profile。跨平台发行需在目标平台构建，或提供带产品清单的 `QIANJI_BACKEND_LOCAL_BUNDLE_DIR`。

`catalog.json` 是内部产品技能与助手的白名单；`runtime.tar.gz` 包含 17 项技能及 12 个业务与平台助手的资源。Web 服务与服务端 CLI校验并释放同一资源包，数据库使用 `qianji-backend.db`。产品不包含旧品牌兼容映射或历史数据迁移。

从维护后的千机后端源码更新技能包：

```bash
node packages/shared-scripts/src/prepare-product-resources.js /path/to/QianjiCore
bunx vitest run packages/web-host/src/product
```

更新源码快照时必须同步 `backend.json` 校验和并重新编译、验证前后端协议。打包流程只复制白名单中的助手目录，同时清理无关示例问题。演示汇报与任务规划建议复用产品 i18n 文案，覆盖全部支持的语言；保留助手的其他示例仅选择与业务有关的内容。启动时校验完整助手清单，并拒绝多余模板目录，防止无关助手再次混入。来源、原始版本与许可证见 [SOURCES.md](SOURCES.md)。
