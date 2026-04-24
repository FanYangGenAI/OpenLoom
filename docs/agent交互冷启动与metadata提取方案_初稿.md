# OpenLoom Agent 交互方案（冷启动 / 根目录配置 / 交互式 Metadata 提取）初稿

## 1. 背景与目标

本方案聚焦当前分支要落地的三项能力：

1. 冷启动初始化（首次使用可引导完成必要准备）
2. 用户数据文件夹根目录配置（可持久化、可复用）
3. 交互式方式执行 metadata 提取（从“参数驱动”升级为“对话/向导驱动”）

目标是在尽量复用现有 `extract` 与 `skills` 能力前提下，用最小改动形成一条可用闭环，并为后续演进保留接口。

---

## 2. 现状评估（与目标的差距）

### 2.1 已有能力

- 已有 CLI 提取主链路：`openloom extract <path>`。
- 已有提取能力模块：`TextDocAgent`、`ImageAgent`、`ocr` skill、`exif-reader` skill。
- 已有进度回传机制：目录提取支持 progress callback，gateway 有 WebSocket 事件流。
- 元数据可落盘到 `.openloom/metadata/*`，并支持 hash-skip 与路径刷新。

### 2.2 主要缺口

- 缺少“首次启动状态机”：没有统一初始化入口与完成标记。
- 缺少“根目录配置中心”：目前路径主要靠命令参数传入，缺少持久化配置与多目录管理。
- 缺少“交互式提取向导”：当前以命令参数为主，用户需自行理解复杂选项。
- `openclaw` 目录在当前仓库不可读（被忽略），因此本方案采用“接口对齐 + 行为对齐”策略，而非直接复制代码。

---

## 3. 方案总览（初步）

采用 **1 个轻量配置层 + 3 个编排型 skills + 1 个交互入口命令 + 1 个长期记忆文档**：

- 配置层：统一保存用户初始化状态与根目录配置。
- 编排型 skills：负责“检查/决策/引导”，复用现有提取能力，不重复造轮子。
- 交互命令：承载 agent 与用户对话，按步骤收集参数并驱动提取。
- 长期记忆文档：在 agent 目录下维护 `lessons.md`，沉淀用户偏好与沟通约定。

### 3.1 组件设计

1. `bootstrap-cold-start`（新 skill）
   - 首次启动检查：环境、目录、OCR provider 可用性、API key。
   - 首轮对话 onboarding：询问用户称呼、agent 称呼、沟通风格、输出偏好等。
   - 输出结构化建议与下一步动作，并触发长期记忆写入。

2. `root-dir-manager`（新 skill）
   - 根目录增删改查、启用/禁用、默认目录切换。
   - 提供统一接口给 CLI 与 gateway。

3. `interactive-extract`（新 skill）
   - 交互编排，不直接做提取计算。
   - 负责把用户意图转成 `extract` 参数，再调用现有 pipeline。

4. `openloom setup` / `openloom extract --interactive`（新增命令入口）
   - `setup`：执行冷启动向导。
   - `extract --interactive`：执行交互式提取流程。

---

## 4. 核心数据模型（建议）

建议在 `.openloom/config/` 下增加配置文件：

- `.openloom/config/user-settings.json`
- `.openloom/agent/lessons.md`（长期记忆，必须实现）

建议字段：

- `initialized: boolean`
- `initialized_at: string`
- `default_root_id: string | null`
- `root_dirs: Array<{ id: string; path: string; enabled: boolean; priority: number; include_patterns?: string[]; exclude_patterns?: string[] }>`
- `preferences: { ocr_provider: "online" | "local"; text_concurrency: number; image_concurrency: number; skip_faces: boolean }`
- `last_interactive_session?: { started_at: string; selected_root_id?: string; last_status?: "completed" | "failed" | "cancelled" }`

设计原则：

- 不影响既有 `.openloom/metadata` 文件布局。
- 配置可读可手改，便于调试与迁移。
- 后续可平滑迁移到 SQLite 配置表（先文件，后数据库）。

`lessons.md` 建议记录结构（Markdown）：

- `## UserProfile`
  - `preferred_user_name`
  - `preferred_agent_name`
- `## CommunicationStyle`
  - `tone`（如 concise/friendly/professional）
  - `language_preference`
  - `format_preference`
- `## WorkingAgreements`
  - 用户明确要求的约束（例如先讨论后实现）
- `## UpdateLog`
  - 每次偏好变更的时间与原因

---

## 5. 关键流程

## 5.1 冷启动初始化（首次）

1. 用户执行 `openloom setup`（或首次进入交互式提取时自动触发）。
2. `bootstrap-cold-start` 进入首轮 onboarding，对话式采集以下信息（必须）：
   - 用户希望 agent 如何称呼他
   - 用户希望如何称呼 agent
   - 用户偏好的说话风格与交流方式
   - 输出偏好（简洁/详细、是否先总结后细节）
3. 将 onboarding 结果写入 `.openloom/agent/lessons.md`，作为长期记忆。
4. `bootstrap-cold-start` 做环境检查并返回：
   - 是否已初始化
   - 推荐 root 目录
   - online/local OCR 可用性
   - 阻塞项（如缺少必要环境）
5. 用户确认默认 root 目录与偏好。
6. 写入 `user-settings.json`，标记 `initialized=true`。
7. 可选触发一次“小样本 dry-run 提取”做健康验证。

## 5.2 根目录配置管理

通过 `root-dir-manager` 提供统一操作：

- `list`：列出目录及状态
- `add/remove/update`：维护目录
- `set-default`：设置默认目录
- `enable/disable`：临时开关目录

CLI 侧新增建议：

- `openloom roots list`
- `openloom roots add <path>`
- `openloom roots remove <id>`
- `openloom roots default <id>`

## 5.3 交互式 metadata 提取

1. `openloom extract --interactive` 启动交互流程。
2. `interactive-extract` 分步提问：
   - 选目录（默认 root / 自定义路径）
   - 选 OCR provider（online/local）
   - 是否启用人脸检测
   - 并发档位（safe/balanced/fast）
   - 是否先 dry-run 抽样
3. 生成 `resolved_extract_options`。
4. 调用现有 `extractDirectory` / `extractFile`。
5. 实时显示进度与阶段（scan -> extract -> persist）。
6. 结束后显示 summary，并可一键保存为下次默认策略。

---

## 6. 与现有代码的衔接点

优先复用以下模块，不重写核心逻辑：

- CLI 入口：`src/cli/index.ts`
- 提取命令编排：`src/cli/commands/extract.ts`
- 提取核心：`src/ingestion/extractors/index.ts`
- 文本/图片 agent：`src/ingestion/extractors/text-doc-agent.ts`、`src/ingestion/extractors/image-agent.ts`
- 元数据持久化：`src/ingestion/extractors/persist.ts`

新增代码建议集中在：

- `src/config/user-settings.ts`（配置读写）
- `src/cli/commands/setup.ts`（冷启动命令）
- `src/cli/commands/roots.ts`（根目录管理命令）
- `skills/bootstrap-cold-start/`
- `skills/root-dir-manager/`
- `skills/interactive-extract/`

---

## 7. 分阶段落地建议（MVP 优先）

### Phase A（MVP，先打通）

- 配置文件模型 + 读写工具
- `openloom setup`（包含 onboarding 必答问题）
- `.openloom/agent/lessons.md` 自动创建与更新
- `openloom extract --interactive`（仅最关键问题流）
- `root-dir-manager` 的 `list/add/set-default`

### Phase B（增强体验）

- 多 root + include/exclude patterns
- dry-run 抽样报告（提取前风险提示）
- 失败任务快速重试（按文件类型重跑）

### Phase C（对齐 openclaw 风格）

- 会话态交互（可恢复）
- “建议动作”机制（agent 主动推荐下一步）
- 与 gateway 前端交互统一协议（CLI/WS 一致事件语义）

---

## 8. 风险与取舍

- 若一次性引入太多新 skill，会增加维护成本；建议先做编排型 skill，提取能力继续复用现有实现。
- 首版先做配置文件而非数据库，换取交付速度；后续再迁移到 schema。
- 交互式流程应保证“可降级到非交互命令参数模式”，避免阻塞自动化场景。

---

## 9. 本轮讨论建议题

为了下一轮进入详细设计，建议先对齐以下决策：

1. onboarding 是否允许跳过部分问题，还是必须全部回答后才标记 `initialized=true`？
2. root 目录是否允许多目录并行（MVP 先支持 1 个还是直接支持多个）？
3. 交互式提取是否默认开启 dry-run？
4. `interactive-extract` 是做成独立命令（`openloom wizard`）还是挂在 `extract --interactive` 下？

---

## 10. 结论

该初稿方案以“最小侵入 + 复用既有 pipeline”为原则，可在当前分支先快速形成冷启动、根目录配置和交互提取的闭环；后续再逐步向 openclaw 风格的会话化与建议化体验演进。
