# allinone-todo

AllInOne 示例插件「待办」的独立发行仓库。插件源码、构建产物与 GitHub Release 资产都在这里维护；主仓库不再承载该插件的发布。

## 插件信息

| 项           | 值                                                     |
| ------------ | ------------------------------------------------------ |
| 插件 id      | `com.pastsheep.todo`                                   |
| 当前版本     | `0.1.0`                                                |
| 名称         | 待办                                                   |
| 权限         | `notifications`                                        |
| 依赖         | `allinone.storage` `^0.1.0`（随应用提供的内置插件）     |
| 宿主入口     | `dist/main.js`（CJS）                                  |
| UI 入口      | `dist/ui.js`（ESM）                                    |
| 图标         | `assets/icon.svg`                                      |
| 最低应用版本 | `>=0.1.0 <1.0.0`（`engines.allinone`）                 |

`allinone.json` 是唯一 manifest 事实源；命令、页面、插槽 id 均以插件 id 为前缀。

## 目录结构

```text
.
├── allinone.json          # 插件 manifest（版本、权限、依赖、贡献点）
├── dist/                  # 构建产物（提交进仓库，并打进 Release ZIP）
│   ├── main.js            # 宿主插件入口（CJS）
│   └── ui.js              # UI 插件入口（ESM）
├── assets/icon.svg
├── src/
│   ├── main.ts            # 宿主：命令注册、存储迁移
│   ├── store.ts           # 数据模型与纯函数
│   └── ui.ts              # 页面、侧边栏、状态栏渲染
├── package.json
├── tsconfig.json
├── LICENSE
└── README.md
```

## 构建

需要 Node.js 24+ 与 pnpm 11+：

```powershell
pnpm install
pnpm build
```

构建使用 esbuild，产物写入 `dist/`。`@allinone/plugin-api` 仅作为类型依赖使用；类型检查需要先链接 AllInOne 主仓库中的该包，运行时 ZIP 不包含任何 npm 依赖。

## 打包与发布

ZIP **根目录**必须直接包含 `allinone.json`，不要把仓库目录再套一层：

```powershell
Compress-Archive -Path allinone.json,dist,assets,LICENSE -DestinationPath com.pastsheep.todo-0.1.0.zip
Get-FileHash .\com.pastsheep.todo-0.1.0.zip -Algorithm SHA256
(Get-Item .\com.pastsheep.todo-0.1.0.zip).Length
```

发布步骤：

1. 更新 `allinone.json` / `package.json` 中的版本号并重新构建；
2. 提交并打 tag：`git tag v0.1.0 && git push origin main v0.1.0`；
3. 创建 GitHub Release `v0.1.0`，上传 `com.pastsheep.todo-0.1.0.zip`；
4. 把 `sha256`、`size` 与下载地址写入第一方索引仓库 `PastSheep/allinone-registry` 的 `plugins/com.pastsheep.todo.json`；
5. Release 资产不可变：同一版本不替换 ZIP，修复问题发布新版本。

## 数据

待办数据保存在 `plugin-data/com.pastsheep.todo/`，通过 `allinone.storage` 的命名空间存储持久化。卸载插件默认保留数据目录，由用户在插件管理器中决定是否删除。
