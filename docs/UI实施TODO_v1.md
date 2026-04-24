# OpenLoom UI 实施 TODO List v1

> 基于：`docs/UI实施计划_v1.md`  
> 目标：交付 localhost Web UI MVP（Extract -> List -> Detail -> Human Review）  
> 维护方式：按任务打勾推进；每个 Sprint 完成后补充验收结论

---

## Sprint UI-0：准备与基线清理（0.5 天）

- [x] 清理 `src/gateway/server.ts` 重复 import 与明显结构问题
- [x] 固化 UI 路由入口（统一在 `dev-ui/app.js`）
- [x] 约定 WS 消息协议命名与 payload 基本格式
- [x] 增加开发约定：所有新增接口先写 mock response 形状

验收标准：
- [x] `pnpm serve` 可正常启动，无阻断错误
- [x] `dev-ui` 首页可加载并建立 WS 连接

---

## Sprint UI-1：Extract + Metadata 只读闭环（2-3 天）

### A. Extract 控制台

- [x] 新增页面模块：`dev-ui/pages/extract.js`
- [x] 支持输入目录、force、ocr-provider、skip-faces 参数
- [x] 展示提取进度（总数/成功/失败/当前文件）
- [x] 提取结束后提供“查看结果列表”跳转

### B. Metadata 列表页

- [x] 新增页面模块：`dev-ui/pages/metadata-list.js`
- [x] 实现类型筛选（text_doc/image）
- [x] 实现关键词搜索（文件名/summary/entities）
- [x] 实现分页（page/pageSize）
- [x] 列表项可跳转详情页

### C. Metadata 详情页（只读）

- [x] 新增页面模块：`dev-ui/pages/metadata-detail.js`
- [x] 展示 frontmatter 关键字段
- [x] 展示 summary 正文
- [x] 展示 `path_history`
- [x] 展示 `extraction_errors`
- [x] 提供“进入人工校对”按钮

### D. Gateway 只读接口

- [x] 新增 `metadata.list` 消息处理
- [x] 新增 `metadata.get` 消息处理
- [x] 从 `.openloom/metadata/**/*.md` 读取并解析数据
- [x] 返回统一响应结构：`{ ok, data, error? }`

验收标准：
- [x] 可从 UI 完成“提取 -> 列表 -> 详情”只读闭环
- [x] 至少一个 text_doc 和一个 image 条目可正确展示

---

## Sprint UI-2：Human-in-the-Loop 校对与回写（2-3 天）

### A. 校对台页面

- [x] 新增页面模块：`dev-ui/pages/review-workbench.js`
- [x] 可编辑字段：`summary`
- [x] 可编辑字段：`tags.keywords`
- [x] 可编辑字段：`tags.entities.persons/places/orgs/other`
- [x] 可编辑字段：`spatiotemporal[]`（增删改）
- [x] 新增人物补充区：`people_annotations[]`

### B. 回写接口

- [x] 新增 `metadata.updateHumanReview` 消息处理
- [x] 回写到目标 metadata 文件（按 hash 定位）
- [x] 自动写入 `human_review.reviewed_at`
- [x] 记录最小审计信息（field/action/before/after）
- [x] 保存后返回最新 metadata

### C. 页面联动

- [x] 保存成功后刷新详情页数据
- [x] 列表页可显示“已人工校对”状态
- [x] 保存失败时显示可读错误提示

验收标准：
- [x] 用户可完成一次“编辑并保存”并在详情页立即看到结果
- [x] 回写后 markdown 结构可被系统正常再次读取

---

## Sprint UI-3：稳定性与体验收敛（1-2 天）

- [x] 增加统一 loading/empty/error 状态组件
- [x] 增加保存冲突提示（文件已变更）
- [x] 增加基础输入校验（confidence 范围、必填字段）
- [x] 增加最小端到端回归脚本（UI 手工步骤 + 断言清单）
- [x] 补充用户操作说明到 docs（如何使用四个页面）

验收标准：
- [x] 完整走通一条真实样本流程：提取 -> 浏览 -> 校对 -> 回看
- [x] 无阻断级前端错误（控制台/接口）

---

## 跨 Sprint 任务（持续）

- [x] 保持与 `docs/元数据提取方案_v1.md` 字段定义一致
- [x] 保持与 `docs/metadata-regression-report.md` 核心行为一致
- [x] 每个 Sprint 结束后更新本 TODO 文档完成状态
- [x] 每个 Sprint 输出一段“变更摘要 + 风险清单”

---

## 当前执行顺序建议

1. 先做 Sprint UI-0（基线清理）  
2. 再做 Sprint UI-1（只读闭环）  
3. 然后 Sprint UI-2（Human Review 回写）  
4. 最后 Sprint UI-3（稳定性与体验）

---

## 本轮变更摘要

- Gateway 重构为统一 WS request/response 协议，新增 `extract.start`、`metadata.list/get/updateHumanReview`。
- UI 切换为四页式结构（Extract/List/Detail/Review），并拆分页面模块。
- Human Review 支持 summary/entities/spatiotemporal/people_annotations 回写。
- 增加保存冲突检测（基于 metadata 文件版本）与输入校验（JSON 格式、confidence 范围）。
- 新增文档：
  - `docs/UI使用说明_v1.md`
  - `docs/UI验收回归清单_v1.md`

## 当前风险清单

- `metadata.updateHumanReview` 的审计字段目前是最小实现，尚未记录完整 field-level before/after diff。
- 页面分页目前为单页参数化请求，未实现前端翻页控件。
- 并发写入场景仅提供冲突报错，未实现自动合并策略。
