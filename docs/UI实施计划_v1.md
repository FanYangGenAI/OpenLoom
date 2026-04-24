# OpenLoom UI 实施计划 v1.0

> 文档版本：v1.0  
> 日期：2026-04-24  
> 目标阶段：UI Phase 1（本地 localhost MVP）  
> 关联文档：`docs/元数据提取方案_v1.md`、`docs/metadata-regression-report.md`

---

## 1. 目标与结论

### 1.1 目标

在当前元数据提取能力已稳定的基础上，快速落地一个本地可用 UI MVP，完成以下闭环：

1. 发起提取并观察进度
2. 浏览提取结果（metadata 列表）
3. 查看单条详情（frontmatter + summary）
4. Human-in-the-Loop 交互编辑与回写（描述、实体、人物补充）

### 1.2 技术结论（首发形态）

首发采用 **localhost Web UI**（不是桌面壳）：

- 复用现有 `dev-ui` 与 `src/gateway/server.ts`，开发路径最短。
- 最小化工程复杂度，优先验证交互闭环与数据正确性。
- 后续如需桌面版，可在 Phase 2 再封装 Electron/Tauri 外壳。

---

## 2. MVP 范围（四个页面）

### Page A：Extract 控制台

用途：触发提取、查看执行进度与结果摘要。

核心能力：
- 选择输入目录（默认最近路径）
- 配置提取参数（force/ocr-provider/skip-faces）
- 实时展示进度（总数、成功、失败、当前文件）
- 执行完成后跳转到 metadata 列表

### Page B：Metadata 列表

用途：展示 `.openloom/metadata` 中的条目，支持筛选和检索。

核心能力：
- 按文件类型筛选（text_doc / image）
- 按关键词搜索（文件名、summary、entities）
- 显示关键列：file_name、file_type、modified_at、tags 数量、errors 数量
- 点击进入详情页

### Page C：Metadata 详情

用途：查看单条 metadata 的完整信息与来源路径。

核心能力：
- 结构化展示 frontmatter 字段
- 展示正文 summary
- 显示 path_history 时间线
- 显示 extraction_errors
- 提供“进入人工校对”入口

### Page D：Human-in-the-Loop 校对台（新增）

用途：让用户对抽取结果进行人工修正，并可回写到 metadata。

核心能力（MVP）：
- 可编辑字段：
  - `summary`
  - `tags.keywords`
  - `tags.entities.{persons,places,orgs,other}`
  - `spatiotemporal[]`（增删改 period/place/event/confidence）
- 人物补充区（针对 image 或文档中的 persons）：
  - 给已有人物添加说明（notes/alias/relationship）
  - 新增人物候选并标记来源
- 保存策略：
  - 写回对应 metadata 文件
  - 在 frontmatter 新增 `human_review` 信息（reviewed_at, reviewer, notes）
  - 保留机器原始值（避免覆盖不可追踪）

---

## 3. Human-in-the-Loop 数据设计（MVP）

## 3.1 回写原则

- 不破坏已有字段结构，尽量向后兼容。
- 保留原始机器提取结果，人工修正写入并可追溯。
- 所有人工修改要有最小审计信息（时间、字段、前后值摘要）。

## 3.2 建议新增字段

在 `FileMetadata` frontmatter 中追加：

```yaml
human_review:
  reviewed: true
  reviewed_at: "2026-04-24T13:00:00.000Z"
  reviewer: "local-user"
  notes: "Corrected person name and summary wording."
  changes:
    - field: "tags.entities.persons"
      action: "replace"
      before: ["Xiao Li"]
      after: ["Xiao Li Chen"]
```

新增人物描述建议采用可选结构（先轻量）：

```yaml
people_annotations:
  - name: "Xiao Li Chen"
    alias: ["Lily"]
    relationship: "Daughter"
    notes: "Appears in home photos from 2021."
```

说明：
- `people_annotations` 作为人类补充语义，不直接替换 `faces` 技术字段。
- 后续可在 Phase 2 将其回灌到更高层知识图谱（Identity/Timeline Agent）。

---

## 4. 系统结构与接口计划

## 4.1 前端结构（建议）

- `dev-ui/index.html`：应用壳与路由容器
- `dev-ui/app.js`：初始化与路由调度
- `dev-ui/pages/extract.js`
- `dev-ui/pages/metadata-list.js`
- `dev-ui/pages/metadata-detail.js`
- `dev-ui/pages/review-workbench.js`
- `dev-ui/api/client.js`：统一 WS/HTTP 调用封装

## 4.2 Gateway 能力扩展（`src/gateway/server.ts`）

在现有消息基础上新增：

- `metadata.list`
  - 输入：`{ fileType?, keyword?, page?, pageSize? }`
  - 输出：`{ items, total }`
- `metadata.get`
  - 输入：`{ hash, fileType }`
  - 输出：`{ metadata }`
- `metadata.updateHumanReview`
  - 输入：`{ hash, fileType, patch }`
  - 输出：`{ ok: true, updatedAt }`
- `metadata.listPeopleCandidates`
  - 输入：`{ keyword? }`
  - 输出：`{ persons[] }`

MVP 可直接基于 `.openloom/metadata/**/*.md` 读写实现，不强依赖 DB。

---

## 5. 里程碑与工期（建议）

### Sprint UI-1（2-3 天）：页面骨架 + 只读

- 完成 A/B/C 页面与路由
- 打通 `metadata.list`、`metadata.get`
- 详情页显示 path_history 与 errors

验收：
- 能在浏览器完整查看 metadata 条目和详情

### Sprint UI-2（2-3 天）：Human-in-the-Loop 编辑

- 完成 D 页面表单与字段校验
- 打通 `metadata.updateHumanReview` 回写
- 增加最小审计字段写入

验收：
- 用户可编辑并保存 summary/entities/spatiotemporal
- 回写内容可在详情页立即看到

### Sprint UI-3（1-2 天）：联调与体验收敛

- 增加错误提示、保存冲突提示、基础 loading
- 页面间串联（提取完成 -> 列表 -> 详情 -> 校对）
- 完成端到端手工回归清单

验收：
- 完成一条真实样本的“提取 -> 人工修正 -> 回看确认”闭环

---

## 6. 验证方案

## 6.1 功能验证清单

- Extract 页面可触发目录提取并显示进度
- 列表页可按类型和关键词筛选
- 详情页可正确显示 metadata 完整字段
- 校对台可保存以下修改并持久化：
  - summary
  - entities（至少 persons/places）
  - spatiotemporal
  - people_annotations

## 6.2 数据正确性验证

- 保存后重新读取同一 metadata，字段一致
- `human_review.reviewed_at` 自动更新
- 保留原有结构字段，不破坏解析

---

## 7. 风险与约束

- 当前 `src/gateway/server.ts` 有重复 import 等历史问题，建议在 UI 开发前先做一次小规模整理。
- WebSocket 消息协议尚未标准化，新增消息前需统一命名与 payload 结构。
- 直接写 Markdown 文件时要处理并发保存风险（MVP 先单用户串行写）。

---

## 8. Phase 2 预留方向（非 MVP）

- 桌面壳封装（Electron/Tauri）
- 人物实体规范化与去重（跨文件 identity merge）
- 审核队列（待审核/已审核）
- 回滚历史（review diff）
- 与 Knowledge Layer 索引增量同步

