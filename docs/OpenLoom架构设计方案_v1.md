# OpenLoom 架构设计方案 v1.0

> **文档版本**：v1.0
> **关联 PRD**：[第一版PRD.md](./第一版PRD.md)
> **状态**：草案 — 讨论细化中

---

## 1. 架构总览

OpenLoom 是一个 **本地优先的个人知识管家**，它静默扫描用户的数字文件，提取结构化知识，并生成一份有温度的"数字镜像"报告。整体采用 **四层架构**，层与层之间职责清晰、边界明确，最大化复用 OpenClaw 中已验证的设计模式。

```
┌─────────────────────────────────────────────────────────────────────┐
│                         接口层 (Interface Layer)                     │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────────┐    │
│  │   CLI    │   │  Web UI      │   │  Gateway (HTTP + WS)     │    │
│  │          │   │  (Vite+Lit)  │   │  (Local-only Gateway)    │    │
│  └────┬─────┘   └──────┬───────┘   └────────────┬─────────────┘    │
└───────┼────────────────┼────────────────────────┼──────────────────┘
        │                │                        │
┌───────▼────────────────▼────────────────────────▼──────────────────┐
│                      智能层 (Intelligence Layer)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ Identity     │ │ Timeline     │ │ Narrative    │  ← Agents     │
│  │ Agent        │ │ Agent        │ │ Agent        │               │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘               │
│         │                │                │                        │
│  ┌──────▼────────────────▼────────────────▼───────────────────┐   │
│  │            技能引擎 Skills Engine (SKILL.md-based)           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────────┐ │   │
│  │  │ OCR     │ │ EXIF    │ │ PDF     │ │ Image Recognition│ │   │
│  │  │ Skill   │ │ Skill   │ │ Skill   │ │ Skill            │ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └──────────────────┘ │   │
│  └────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬──────────────────────────────────┘
                                 │
┌────────────────────────────────▼──────────────────────────────────┐
│                       知识层 (Knowledge Layer)                      │
│  ┌──────────────────┐  ┌───────────────────┐  ┌────────────────┐  │
│  │ Markdown Store   │  │ Search Engine     │  │ Git Version    │  │
│  │ (Source of Truth)│  │ (FTS + Vector)    │  │ Controller     │  │
│  │                  │  │                   │  │                │  │
│  │ profile.md       │  │ SQLite + FTS5     │  │ Auto-commit    │  │
│  │ timeline.md      │  │ sqlite-vec        │  │ Diff & Revert  │  │
│  │ assets/*.md      │  │ Embedding Cache   │  │                │  │
│  └──────────────────┘  └───────────────────┘  └────────────────┘  │
└────────────────────────────────┬──────────────────────────────────┘
                                 │
┌────────────────────────────────▼──────────────────────────────────┐
│                       感应层 (Ingestion Layer)                      │
│  ┌──────────────┐  ┌───────────────────┐  ┌────────────────────┐  │
│  │ File Scanner │  │ Metadata Extractor│  │ Media Processor    │  │
│  │              │  │                   │  │                    │  │
│  │ Recursive    │  │ EXIF / PDF / Doc  │  │ Thumbnail Gen      │  │
│  │ Watcher      │  │ OCR Pipeline      │  │ Video Keyframe     │  │
│  │ Hash-skip    │  │ Content Classifier│  │                    │  │
│  └──────────────┘  └───────────────────┘  └────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 设计原则

- **高内聚、低耦合**：每一层有且仅有一个核心职责，层与层之间通过明确定义的接口通信，禁止共享可变状态。
- **本地优先的隐私保障**：所有处理都在用户本机完成，Gateway 仅绑定 `127.0.0.1`。
- **Markdown 即真相源**：所有提取的知识都以人类可读、可编辑的 Markdown 文件存储。SQLite 索引是派生产物，可随时从 Markdown 重建。
- **注册式扩展**：新增文件类型、技能、Agent 无需修改已有代码，只需注册即可。

---

## 2. 复用策略 — 从 OpenClaw 中复用什么

| 模块 | 从 OpenClaw 复用 | OpenLoom 新建/扩展 |
|------|-----------------|-------------------|
| **Agent 框架** | 配置驱动的 Agent、agent-scope、agent events、subagent spawn、model fallback | 新增 Identity / Timeline / Narrative 三个 Agent 配置 |
| **技能引擎** | SKILL.md 格式、多源加载、资格过滤、SkillSnapshot、env overrides | 新建感知类技能：OCR、EXIF、PDF、图像识别 |
| **Markdown 存储** | MEMORY.md 模式、markdown IR、frontmatter 解析 | 扩展为结构化知识库（profile.md / timeline.md / assets/） |
| **搜索引擎** | SQLite + FTS5 + sqlite-vec、chunk + embed 管线、hash-skip、混合搜索 | 增加 OCR 文本索引、文件类型权重 |
| **配置系统** | JSON/JSON5 config、Zod schema 校验、merge-patch、env 变量替换 | 扩展 scanner / knowledge / agent 配置段 |
| **Gateway** | HTTP + WebSocket 架构、方法处理器注册机制 | 简化为仅本地可访问；新增扫描进度推送 |
| **Web UI** | Vite + Lit 技术栈 | 全新 UI：报告页、搜索页、编辑器、时间线视图 |
| **Git 集成** | 工作区 `git init` | 扩展为自动 commit + diff + revert 的"后悔药"机制 |
| **文件监控** | chokidar + debounce 模式 | 扩展以支持 TB 级增量扫描 |
| **事件系统** | agent events、transcript subscriptions | 扩展扫描进度事件、知识更新事件 |

---

## 3. 各层详细设计

### 3.1 感应层 (Ingestion Layer)

**职责**：静默扫描用户指定的目录，从所有文件中提取元数据和内容摘要。

#### 目录结构

```
src/ingestion/
├── scanner/
│   ├── walker.ts           # Recursive directory walker, stream-based (async iterator)
│   ├── hash-registry.ts    # Hash-based skip (reuse OpenClaw pattern)
│   ├── watcher.ts          # chokidar incremental watch
│   └── throttle.ts         # CPU/IO throttle for TB-level data
├── extractors/
│   ├── registry.ts         # Extractor registry (by file type)
│   ├── image-extractor.ts  # EXIF, GPS, faces, dimensions
│   ├── document-extractor.ts  # PDF, DOCX, TXT content extraction
│   ├── media-extractor.ts  # Video/audio metadata, keyframes
│   └── types.ts            # FileMetadata interface
├── classifier/
│   ├── file-classifier.ts  # Classify files into categories
│   └── content-tagger.ts   # Tag content with semantic labels
└── events.ts               # ScanProgress events (reuse agent-events pattern)
```

#### 核心设计要点

- **两阶段扫描**：第一阶段仅提取轻量元数据（文件名、大小、时间、类型），分钟级完成；第二阶段按时间段分批做深度内容提取（OCR、PDF 解析等），渐进式呈现结果。
- **流式遍历 (Stream-based Walker)**：使用 async iterator 而非将完整文件列表加载到内存。TB 级数据也不会 OOM。
- **哈希跳过 (Hash-skip)**：复用 OpenClaw 的 `files.hash` 比对模式——文件内容未变则跳过重新深度提取；若仅路径/文件名变化，可轻量更新元数据中的路径字段并记录 `path_history`（详见 [元数据提取方案_v1.md](./元数据提取方案_v1.md) 5.1 节）。
- **提取器注册表 (Extractor Registry)**：每种文件类型一个独立的提取器，新增类型只需注册一个新的提取器，不改动已有代码。
- **时间分段提取 (Time-based Batching)**：深度提取阶段按文件修改时间分批处理，默认由近到远，每完成一批即更新知识库和报告。
- **IO 节流 (Throttle)**：可配置的并发上限和 IO 优先级，防止扫描器让电脑"罢工"。

#### FileMetadata 接口

```typescript
interface FileMetadata {
  path: string;
  hash: string;
  size: number;
  mtime: number;
  type: FileType;        // image | document | video | audio | archive | other
  extracted: {
    text?: string;        // OCR / parsed content
    exif?: ExifData;
    gps?: GeoLocation;
    faces?: FaceInfo[];
    tags?: string[];
    summary?: string;
  };
}

type FileType = "image" | "document" | "video" | "audio" | "archive" | "other";
```

#### 提取器注册表模式

```typescript
interface FileExtractor {
  supportedExtensions: string[];
  extract(filePath: string, stats: FileStats): Promise<ExtractedData>;
}

class ExtractorRegistry {
  private extractors: Map<string, FileExtractor> = new Map();

  register(extractor: FileExtractor): void { /* ... */ }
  getExtractor(extension: string): FileExtractor | undefined { /* ... */ }
}
```

---

### 3.2 知识层 (Knowledge Layer)

**职责**：将提取的元数据转化为结构化的 Markdown 知识，提供搜索能力，并管理版本历史。

#### 目录结构

```
src/knowledge/
├── store/
│   ├── workspace.ts        # Knowledge workspace management
│   ├── profile.ts          # User profile knowledge (profile.md)
│   ├── timeline.ts         # Life events timeline (timeline.md)
│   ├── assets.ts           # Per-asset knowledge (assets/*.md)
│   └── schema.ts           # Knowledge markdown schema / templates
├── index/
│   ├── memory-schema.ts    # SQLite schema (reuse + extend OpenClaw)
│   ├── sync-index.ts       # Hash-based incremental sync
│   ├── chunk.ts            # Markdown chunking (reuse OpenClaw)
│   ├── embed.ts            # Embedding pipeline (reuse OpenClaw)
│   └── search.ts           # Hybrid search: FTS + vector (reuse OpenClaw)
├── git/
│   ├── version-control.ts  # Auto-commit on knowledge changes
│   ├── diff.ts             # Show what changed
│   └── revert.ts           # Revert to previous version
└── markdown/
    ├── ir.ts               # Reuse OpenClaw markdown IR
    ├── render.ts           # Reuse OpenClaw render
    └── frontmatter.ts      # Reuse OpenClaw frontmatter
```

#### Markdown 知识库结构

```
~/.openloom/knowledge/
├── profile.md              # 用户身份：职业、家庭角色、兴趣爱好
├── timeline.md             # 按时间排列的人生大事件
├── places.md               # 重要地点
├── people.md               # 关键人物（家人、同事）
├── assets/
│   ├── insurance/
│   │   └── state-farm-auto-2025.md
│   ├── travel/
│   │   └── orlando-family-trip-2025-04.md
│   └── career/
│       └── applied-scientist-resume.md
├── .git/                   # 自动管理的 git 仓库
└── index.sqlite            # 搜索索引（不提交到 git）
```

#### 知识 Markdown 格式

每个 `.md` 文件使用 YAML frontmatter 存储结构化元数据：

```markdown
---
type: event
date: 2025-04-15
location: Orlando, FL
people: [Fan Yang, Xiao Li Chen]
confidence: 0.85
source_files:
  - /photos/2025/IMG_3421.jpg
  - /photos/2025/IMG_3422.jpg
last_updated: 2025-04-20T10:30:00Z
---
# Orlando Family Trip — April 2025

A week-long family vacation to Orlando. Visited theme parks and ...
```

#### Git "后悔药"机制

在 OpenClaw 基础的 `git init` 之上，扩展为完整的版本控制工作流：

- **自动提交**：每次 Agent 写入或更新 `.md` 文件后，自动创建一个带语义化 commit message 的提交（如 `"agent: update timeline — added Orlando trip"`）。
- **Diff 接口**：Gateway 暴露 `knowledge.diff` 方法，返回任意两个 commit 之间的变更内容。
- **回滚接口**：Gateway 暴露 `knowledge.revert` 方法，可将指定文件（或整个知识库）恢复到某个历史版本。
- **用户编辑**：当用户通过 UI 编辑器手动修改 Markdown 时，commit message 会标注来源（如 `"user: correct name in people.md"`）。提交后系统自动重建索引。

---

### 3.3 智能层 (Intelligence Layer)

**职责**：基于 Agent + Skills 模式，分析元数据、提取身份和事件、生成叙事报告。

#### 目录结构

```
src/agents/
├── agent-scope.ts          # Reuse OpenClaw agent-scope
├── agent-events.ts         # Reuse OpenClaw agent events
├── model-fallback.ts       # Reuse OpenClaw model fallback
├── system-prompt.ts        # Adapted system prompt builder
├── pi-embedded-runner/     # Reuse OpenClaw Pi runner
└── configs/
    ├── identity-agent.ts   # Identity recognition agent config
    ├── timeline-agent.ts   # Timeline extraction agent config
    └── narrative-agent.ts  # Narrative generation agent config

skills/
├── ocr/
│   └── SKILL.md            # DeepSeek OCR skill
├── exif-reader/
│   └── SKILL.md            # EXIF metadata extraction
├── pdf-parser/
│   └── SKILL.md            # PDF content extraction
├── image-recognition/
│   └── SKILL.md            # Scene / face / object recognition
├── geo-resolver/
│   └── SKILL.md            # GPS coordinates → place name
└── document-classifier/
    └── SKILL.md            # Document type classification
```

#### 三个核心 Agent 的职责分工

| Agent | 输入 | 输出 | 调用的 Skills |
|-------|------|------|-------------|
| **Identity Agent** | 全部文件元数据 | `profile.md` — 职业、家庭角色、兴趣爱好 | image-recognition, document-classifier |
| **Timeline Agent** | 文件元数据 + GPS + 日期 | `timeline.md` + `assets/*.md` — 人生事件 | exif-reader, geo-resolver, ocr |
| **Narrative Agent** | profile.md + timeline.md | "数字镜像"报告文本 | 无（纯 LLM 生成） |

#### Agent 编排流程

复用 OpenClaw 的 subagent spawn 模式：

```
[扫描完成]
    │
    ├──→ Identity Agent (分析身份)        ─┐
    │                                      ├──→ [两者均完成]
    └──→ Timeline Agent (提取事件)        ─┘         │
                                                     ▼
                                           Narrative Agent
                                           (生成报告)
                                                     │
                                                     ▼
                                           "数字镜像"报告
```

- Identity Agent 和 Timeline Agent **并行执行**（互不依赖）。
- Narrative Agent 在 **两者都完成后** 执行（依赖它们的输出）。
- 使用 `subagent spawn` + `agent.wait` 进行编排：父协调者 spawn 子 Agent 并等待完成。

#### SKILL.md 格式示例

```markdown
---
name: ocr
description: "Extract text from images using DeepSeek OCR API"
metadata:
  openclaw:
    emoji: "🔍"
    primaryEnv: DEEPSEEK_API_KEY
    requires:
      env: [DEEPSEEK_API_KEY]
---
# OCR Skill

Use this skill when you need to extract text content from images,
scanned documents, receipts, or any image containing text.

## Usage

Call the DeepSeek OCR API with the image path...
```

---

### 3.4 接口层 (Interface Layer)

**职责**：提供面向用户的交互界面 — CLI 面向高级用户，Web UI 面向日常使用，Gateway 作为桥梁。

#### 目录结构

```
src/gateway/
├── server.ts               # Local HTTP + WebSocket (reuse OpenClaw pattern)
├── methods/
│   ├── scan.ts             # Start / stop / status scan
│   ├── search.ts           # Semantic search
│   ├── report.ts           # Get digital mirror report
│   ├── knowledge.ts        # CRUD knowledge markdown
│   └── history.ts          # Git diff / revert operations
└── middleware/
    └── local-only.ts       # Reject non-localhost requests

src/cli/
├── commands/
│   ├── scan.ts             # openloom scan /path/to/dir
│   ├── search.ts           # openloom search "insurance"
│   ├── report.ts           # openloom report
│   └── status.ts           # openloom status
└── index.ts

ui/
├── src/
│   ├── views/
│   │   ├── report.ts       # Digital mirror report view
│   │   ├── search.ts       # Semantic search interface
│   │   ├── editor.ts       # Markdown knowledge editor
│   │   ├── timeline.ts     # Visual timeline
│   │   └── scan-progress.ts # Scan progress dashboard
│   ├── components/         # Reusable Lit components
│   └── main.ts
├── package.json
└── vite.config.ts
```

#### 本地隐私网关

- Gateway 仅绑定 `127.0.0.1`，外部不可访问。
- `local-only.ts` 中间件拒绝所有非 localhost 来源的请求。
- 无需身份验证（单用户、本地机器）。
- 通过 WebSocket 实时推送扫描进度和知识更新事件给 UI。

#### Gateway 方法列表

| 方法 | 类型 | 说明 |
|------|------|------|
| `scan.start` | 写 | 开始扫描指定目录 |
| `scan.stop` | 写 | 停止正在进行的扫描 |
| `scan.status` | 读 | 获取当前扫描进度 |
| `search.query` | 读 | 对知识库进行语义搜索 |
| `report.get` | 读 | 获取"数字镜像"报告 |
| `knowledge.list` | 读 | 列出所有知识文件 |
| `knowledge.get` | 读 | 获取指定 Markdown 文件内容 |
| `knowledge.update` | 写 | 更新知识 Markdown 文件 |
| `history.diff` | 读 | 获取版本之间的差异 |
| `history.revert` | 写 | 将文件恢复到历史版本 |

---

## 4. 端到端数据流

```
用户指定一个根目录（如 ~/Documents、外接硬盘）
    │
    ▼
[1] Scanner — 流式遍历 + 哈希跳过
    │
    ├── 图片  → EXIF Extractor  → GPS / 日期 / 相机信息
    ├── PDF   → PDF Extractor   → 文本内容
    ├── 文档  → Doc Extractor   → 文本内容
    └── 其他  → Classifier      → 文件类型标签
    │
    ▼
[2] FileMetadata[] → Knowledge Writer
    │
    ├── chunk + embed → SQLite 索引 (FTS + Vector)
    ├── Identity Agent → profile.md
    ├── Timeline Agent → timeline.md + assets/*.md
    └── git auto-commit
    │
    ▼
[3] Narrative Agent 读取 profile.md + timeline.md
    │
    ▼
[4] "数字镜像"报告 → Gateway → Web UI
    │
    ▼
[5] 用户编辑 Markdown → git commit → 索引重建
```

---

## 5. 技术栈选型

| 层面 | 技术 | 选型理由 |
|------|------|----------|
| 语言 | TypeScript (ESM, Node ≥22) | 与 OpenClaw 保持一致，可直接复用代码 |
| 包管理 | pnpm (monorepo) | 复用 OpenClaw 的 workspace 模式 |
| 构建 | tsdown | 复用 OpenClaw |
| 测试 | Vitest | 复用 OpenClaw |
| LLM 主模型 | OpenAI / Gemini (API) | 双 Provider 支持，通过配置切换 |
| LLM 本地模型 | DeepSeek OCR 等 | 感知类任务走本地模型 |
| LLM 执行运行时 | Pi Runner 或 Vercel AI SDK | 待 Spike 评估后确定（见 9.4） |
| Embedding | 本地模型优先 + API 可选 | 默认离线可用，可配置为 API 调用 |
| 数据库 | SQLite + sqlite-vec + FTS5 | 复用 OpenClaw，本地零依赖 |
| Web UI | Vite + Lit | 复用 OpenClaw，轻量化 |
| CLI | Commander | 复用 OpenClaw |
| 文件监控 | chokidar | 复用 OpenClaw |
| OCR | DeepSeek OCR (通过 Skill) | PRD 中指定 |
| PDF 解析 | PDF.js | OpenClaw 中已有此依赖 |
| 图片处理 | Sharp | OpenClaw 中已有此依赖 |
| EXIF | exifr | 轻量级，纯 JS 实现 |
| Git 操作 | simple-git | 比直接调用 CLI 更稳定 |

---

## 6. Monorepo 工程结构

```
OpenLoom/
├── package.json              # 根 workspace
├── pnpm-workspace.yaml       # ., ui, packages/*, extensions/*
├── tsconfig.json
├── tsdown.config.ts
│
├── src/                      # 核心源码
│   ├── ingestion/            # 扫描器 + 提取器
│   ├── knowledge/            # Markdown 存储 + 索引 + Git
│   ├── agents/               # Agent 框架（从 OpenClaw 适配）
│   ├── gateway/              # 本地专用网关
│   ├── cli/                  # CLI 命令
│   ├── config/               # 配置管理
│   ├── markdown/             # Markdown 工具库
│   ├── events/               # 事件总线
│   └── utils/                # 通用工具
│
├── skills/                   # 内置 SKILL.md 技能
│   ├── ocr/
│   ├── exif-reader/
│   ├── pdf-parser/
│   ├── image-recognition/
│   ├── geo-resolver/
│   └── document-classifier/
│
├── ui/                       # Web UI (Vite + Lit)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
│
├── doc/                      # 项目文档
├── tasks/                    # 项目管理
│   ├── todo.md
│   └── lessons.md
│
└── openclaw/                 # OpenClaw 参考代码（已 gitignore）
```

---

## 7. 可扩展性设计

每个扩展点都遵循 **开闭原则（Open-Closed Principle）**：

| 扩展点 | 扩展机制 | 举例 |
|--------|---------|------|
| 新增文件类型支持 | 在 ExtractorRegistry 中注册新的提取器 | 添加 `email-extractor.ts` 处理 `.eml` 文件 |
| 新增感知能力 | 在 `skills/` 下创建新的 `SKILL.md` | 添加 `speech-to-text/SKILL.md` |
| 新增分析维度 | 新增 Agent 配置 + 对应的 Markdown 模板 | 添加"财务 Agent"分析财务文件 |
| 新增搜索策略 | 在搜索引擎中添加新的评分器 | 添加时间衰减 / 近期权重提升 |
| 新增 UI 视图 | 添加 Lit 组件 + Gateway 方法 | 添加"财务概览"页面 |
| 多设备同步（V2） | 在知识层之上添加同步层 | 不影响现有架构 |
| 插件系统（V2） | 复用 OpenClaw 的 extension/plugin SDK 模式 | 第三方提取器和技能 |

---

## 8. 实施优先级

| 优先级 | 模块 | 理由 |
|--------|------|------|
| **P0** | 感应层 Scanner + 基础 Extractors | 没有数据就没有产品 |
| **P0** | 知识层 Markdown Store + SQLite 索引 | 数据需要存储的地方 |
| **P0** | 基础 Gateway + CLI | 需要接口来驱动整条管线 |
| **P1** | Identity Agent + Timeline Agent | 核心的"懂你"能力 |
| **P1** | OCR Skill + EXIF Skill | 感知能力的基础 |
| **P1** | Narrative Agent | "惊艳时刻"的关键 |
| **P2** | Web UI（报告 + 搜索） | 用户可见的界面 |
| **P2** | Git 版本控制 | "后悔药"机制 |
| **P3** | 文件监控（增量更新） | 首次全量扫描之后的持续更新 |

---

## 9. 关键决策记录

以下是架构讨论中已达成共识的关键决策。

### 9.1 LLM 选型 ✅ 已确定

**决策**：采用 **多层模型策略**，API 模型与本地模型并存。

| 用途 | 模型 | 调用方式 |
|------|------|---------|
| 主模型（Agent 推理、叙事生成） | OpenAI / Gemini | API 调用 |
| OCR（文字识别） | DeepSeek OCR | 本地模型 |
| 其他特定感知任务 | 按需选择本地模型 | 本地调用 |

**设计要点**：
- 主模型层需要做 **Provider 抽象**，支持在 OpenAI 和 Gemini 之间切换，通过配置选择。
- 本地模型（如 DeepSeek OCR）通过 Skill 封装调用，不直接耦合到 Agent 框架中。
- 后续可按需扩展更多 Provider（如 Anthropic、本地 LLM 等），不影响上层代码。

### 9.2 Embedding 模型 ✅ 已确定

**决策**：**本地模型优先，同时支持 API 调用**。

- 默认使用本地 Embedding 模型（如 all-MiniLM），保证离线可用和隐私。
- 提供 API Embedding 作为可选项（如 OpenAI Embedding），通过配置切换。
- Embedding Provider 做统一抽象，上层搜索引擎不感知具体实现。

### 9.3 扫描策略 ✅ 已确定

**决策**：采用 **两阶段扫描 + 分段提取** 策略。

**第一阶段：快速元数据扫描（分钟级）**
- 遍历文件系统，提取文件名、大小、修改时间、文件类型等轻量元数据。
- 不打开文件内容，速度极快，TB 级可在分钟内完成。
- 扫描完成后即可给出文件概览（共多少张照片、多少份文档等）。

**第二阶段：深度内容提取（渐进式）**
- 按时间段分批提取文件内容（OCR、PDF 解析、EXIF 读取等）。
- 提取顺序可配置：**由近到远**（默认，优先处理最近的文件，用户更可能关心）或 **由远到近**。
- 每完成一个时间段的提取，立即更新知识库并刷新报告，用户可以 **分阶段** 看到结果逐步丰富。
- 后台持续运行，不阻塞用户交互。

```
[第一阶段] 快速扫描（分钟级）
    → 文件概览 + 基础统计
    → 用户已可看到初步结果

[第二阶段] 深度提取（渐进式，可能数小时）
    → 批次 1: 最近 3 个月文件 → 更新知识库 → 刷新报告
    → 批次 2: 3-12 个月文件   → 更新知识库 → 刷新报告
    → 批次 3: 1-3 年文件      → 更新知识库 → 刷新报告
    → 批次 4: 3 年以上文件    → 更新知识库 → 刷新报告
    → ...持续直到全部完成
```

### 9.4 LLM 执行运行时 ✅ 待评估后确定

**背景**：OpenClaw 使用 Pi Runner（`@mariozechner/pi-*` 包）作为 Agent 与 LLM 之间的执行中间层，负责会话管理、System Prompt 构建、Tool Calling 路由、流式响应、上下文压缩、模型回退等。

**决策**：在实施前做一次 **技术 Spike**，评估 Pi Runner 的独立性：
- 如果 Pi 与 OpenClaw 的耦合度低，可以独立使用 → **直接复用**，节省开发时间。
- 如果 Pi 与 OpenClaw 绑定过深 → **改用 Vercel AI SDK** 等主流替代方案，自行搭建 session 管理和 tool 调度。

### 9.5 知识 Markdown 格式兼容性 ✅ 已确定

**决策**：**这不是一个需要专项设计的问题。**

Markdown 半结构化存储天然解决了传统数据库中的 Schema 演进难题：
- LLM 按自然语言理解 Markdown 内容，不依赖固定字段名。
- 搜索引擎使用 FTS 全文检索 + Vector 语义匹配，不依赖 frontmatter 字段结构。
- 新版本的 Agent 多写几个字段，旧内容照样能被读取和理解。

**唯一的编码规范**：UI 层从 frontmatter 读取字段时，所有字段一律按 optional 处理——缺失则不展示，不报错。这是基本的防御性编程，无需额外的迁移机制。
