# OpenLoom Agent 交互方案（冷启动 / 根目录配置 / 交互式 Metadata 提取）初稿

## 1. 背景与目标

本方案聚焦当前分支要落地的三项能力：

1. 冷启动初始化（首次使用可引导完成必要准备）
2. 用户数据文件夹根目录配置（可持久化、可复用）
3. 交互式方式执行 metadata 提取（从“参数驱动”升级为“对话/向导驱动”）

目标是在尽量复用现有 `extract` 与 `skills` 能力前提下，用最小改动形成一条可用闭环，并为后续演进保留接口。

新增约束（本次讨论后确认）：

- 涉及 Agentic agent 的实现逻辑，需遵从 OpenClaw 的设计范式（wizard/onboarding + workspace bootstrap + 持续记忆文件体系）。

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
- 与 OpenClaw 差距：当前方案偏“单命令 setup + 单文件 lessons”，而 OpenClaw 偏“wizard 流程 + bootstrap 文件体系 + onboarding 状态文件”。

---

## 3. OpenClaw 对齐原则（Agentic 必须遵循）

以下原则适用于 OpenLoom 中所有 Agentic 能力（不仅是 setup）：

1. 采用 wizard 式流程编排，而非散落的参数问答。
2. 首次启动由 bootstrap 文件引导 agent 与用户完成身份和协作关系建立。
3. 长期记忆采用“分文件分职责”结构，避免单文件大而全导致冲突。
4. onboarding 完成状态使用独立状态文件记录，不依赖临时变量。
5. 默认允许人机共同演化记忆文档（可手改），程序负责稳健 merge 与状态推进。
6. 交互式提取属于 onboarding 后续能力，需遵守同一交互抽象和状态机。

---

## 4. 方案总览（OpenClaw 对齐版）

采用 **Wizard 层 + Workspace Bootstrap 层 + 配置状态层 + 提取编排层 + Skills 层**：

- Wizard 层：统一承载首轮对话、配置确认、后续交互提取问答。
- Workspace Bootstrap 层：通过模板文件引导“你是谁/我是谁/如何协作”。
- 配置状态层：保存初始化状态、默认 root、提取偏好与 onboarding 元信息。
- 提取编排层：交互式参数解析后复用现有 `extract` pipeline。
- Skills 层：只做能力调用和编排，不承载核心状态机。

### 4.1 组件设计（调整后）

1. `bootstrap-cold-start`（新 skill）
   - 首次启动检查：环境、目录、OCR provider 可用性、API key。
   - 调起 Wizard，执行 bootstrap 引导问题，不直接硬编码完整流程。
   - 仅负责 orchestration，不直接决定最终记忆结构。

2. `root-dir-manager`（新 skill）
   - 根目录增删改查、启用/禁用、默认目录切换。
   - 提供统一接口给 CLI 与 gateway。

3. `interactive-extract`（新 skill）
   - 交互编排，不直接做提取计算。
   - 负责把用户意图转成 `extract` 参数，再调用现有 pipeline。

4. `openloom setup` / `openloom extract --interactive`（新增命令入口）
   - `setup`：执行 wizard onboarding（OpenClaw 风格）。
   - `extract --interactive`：执行 wizard 子流程（提取配置分支）。

5. Workspace bootstrap 记忆文件（新增）
   - `IDENTITY.md`（Agent identity）
   - `USER.md`（User profile）
   - `SOUL.md`（协作风格与边界）
   - `BOOTSTRAP.md`（首次对话引导，用后可标记完成）
   - `lessons.md`（运行期结构化记忆与更新日志）

---

## 5. 核心数据模型（OpenClaw 对齐）

建议在 `.openloom/config/` 下增加配置文件：

- `.openloom/config/user-settings.json`
- `.openloom/agent/workspace-state.json`（onboarding 状态，必须新增）

建议在 `.openloom/agent/` 下增加 bootstrap 文件：

- `.openloom/agent/BOOTSTRAP.md`
- `.openloom/agent/IDENTITY.md`
- `.openloom/agent/USER.md`
- `.openloom/agent/SOUL.md`
- `.openloom/agent/lessons.md`

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

`workspace-state.json` 建议字段：

- `version: 1`
- `bootstrapSeededAt?: string`
- `onboardingCompletedAt?: string`
- `lastWizardRunAt?: string`
- `lastWizardSource?: "setup" | "extract-interactive" | "manual"`

---

## 6. 关键流程（对齐版）

## 6.1 冷启动初始化（首次）

1. 用户执行 `openloom setup`（或首次进入交互式提取时自动触发）。
2. 系统检查 `workspace-state.json`，若未完成 onboarding：
   - 先 seed `BOOTSTRAP.md` / `IDENTITY.md` / `USER.md` / `SOUL.md`（若不存在）
   - 进入 wizard onboarding 流程
3. wizard 对话式采集以下信息（必须提问，可 skip）：
   - 用户希望 agent 如何称呼他
   - 用户希望如何称呼 agent
   - 用户偏好的说话风格与交流方式
   - 输出偏好（简洁/详细、是否先总结后细节）
4. 将信息同步写入 `IDENTITY.md` / `USER.md` / `SOUL.md` 与 `lessons.md`。
5. `bootstrap-cold-start` 做环境检查并返回：
   - 是否已初始化
   - 推荐 root 目录
   - online/local OCR 可用性
   - 阻塞项（如缺少必要环境）
6. 用户确认默认 root 目录与偏好。
7. 写入 `user-settings.json`，并更新 `workspace-state.json.onboardingCompletedAt`。
8. 可选触发一次“小样本 dry-run 提取”做健康验证。

## 6.2 根目录配置管理

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

## 6.3 交互式 metadata 提取

1. `openloom extract --interactive` 启动交互流程。
2. 若 onboarding 未完成，先转入 `setup wizard`。
3. `interactive-extract` 分步提问：
   - 选目录（默认 root / 自定义路径）
   - 选 OCR provider（online/local）
   - 是否启用人脸检测
   - 并发档位（safe/balanced/fast）
   - 是否先 dry-run 抽样
4. 生成 `resolved_extract_options`。
5. 调用现有 `extractDirectory` / `extractFile`。
6. 实时显示进度与阶段（scan -> extract -> persist）。
7. 结束后显示 summary，并将用户新偏好增量合并到 `lessons.md`。

---

## 7. 与现有代码的衔接点

优先复用以下模块，不重写核心逻辑：

- CLI 入口：`src/cli/index.ts`
- 提取命令编排：`src/cli/commands/extract.ts`
- 提取核心：`src/ingestion/extractors/index.ts`
- 文本/图片 agent：`src/ingestion/extractors/text-doc-agent.ts`、`src/ingestion/extractors/image-agent.ts`
- 元数据持久化：`src/ingestion/extractors/persist.ts`

新增代码建议集中在：

- `src/config/user-settings.ts`（配置读写）
- `src/config/workspace-state.ts`（onboarding 状态读写）
- `src/cli/commands/setup.ts`（冷启动命令）
- `src/cli/commands/roots.ts`（根目录管理命令）
- `src/wizard/*`（建议新增，承载 wizard 流程与抽象 prompter）
- `src/config/agent-memory/*`（建议新增，管理 IDENTITY/USER/SOUL/lessons 的合并）
- `skills/bootstrap-cold-start/`
- `skills/root-dir-manager/`
- `skills/interactive-extract/`

---

## 8. 分阶段落地建议（MVP 优先）

### Phase A（MVP，先打通）

- wizard 抽象与 setup 主流程统一
- bootstrap 模板文件自动 seed（IDENTITY/USER/SOUL/BOOTSTRAP）
- `workspace-state.json` 引入并接管 onboarding 完成判定
- `openloom setup`（包含 onboarding 必答问题）
- `.openloom/agent/lessons.md` 自动创建与更新（增量 merge）
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
- bootstrap 生命周期管理（完成后 BOOTSTRAP 归档或标记）

---

## 9. 风险与取舍

- 若一次性引入太多新 skill，会增加维护成本；建议先做编排型 skill，提取能力继续复用现有实现。
- 首版先做配置文件而非数据库，换取交付速度；后续再迁移到 schema。
- 交互式流程应保证“可降级到非交互命令参数模式”，避免阻塞自动化场景。
- 采用多记忆文件后，需要明确 merge 规则与权威来源，避免字段漂移。

---

## 10. 本轮讨论建议题

为了下一轮进入详细设计，建议先对齐以下决策：

1. `BOOTSTRAP.md` 在 onboarding 完成后是删除、归档，还是保留并打标？
2. `lessons.md` 与 `USER/IDENTITY/SOUL` 的权威优先级怎么定义（冲突时谁覆盖谁）？
3. 交互式提取是否默认开启 dry-run？
4. wizard 抽象是否一次性在 `setup` 与 `extract --interactive` 统一？

---

## 11. 结论

方案已从“功能可用”升级为“Agentic 逻辑对齐 OpenClaw”。后续实现将以 wizard + bootstrap + 状态文件 + 分职责记忆为主线，确保冷启动、长期记忆和交互提取在同一套 agent 运行逻辑下演进。
