# OpenLoom Agent 交互双模式冷启动实施方案 v1

## 1. 目标与范围

本方案用于在现有 `USER.md` 与冷启动文件体系基础上，实现 Agent 与用户对话的双模式冷启动，并严格遵循 OpenClaw 风格实现方法。

目标：

- 支持双模式冷启动：
  - 模式一：无 metadata，走交互式建档。
  - 模式二：已有 metadata，走确认/补充/冲突澄清。
- CLI 先行落地，后续无缝扩展到 UI。
- 保持记忆文件分责、状态可恢复、冲突可追溯。

非目标（本轮不做）：

- 不重构 metadata 抽取管线核心格式。
- 不做 UI 全量重写，只预留协议与状态接口。

---

## 2. OpenClaw 对齐约束

本实现必须遵守以下范式（与现有代码方向一致）：

1. Wizard 驱动交互，而非散落问答。
2. Workspace bootstrap 文件体系作为长期记忆入口：
   - `BOOTSTRAP.md`
   - `IDENTITY.md`
   - `USER.md`
   - `SOUL.md`
   - `lessons.md`
3. 独立状态文件驱动生命周期：`workspace-state.json`。
4. 记忆更新采用增量合并和字段级变更，避免整文件覆盖。
5. 冲突不静默覆盖，关键冲突需进入确认回路。

---

## 3. 双模式冷启动定义

### 3.1 模式一：Interactive Blank（无 metadata）

触发条件（建议）：

- `.openloom/metadata/` 无有效数据，且
- 当前画像信息不足以支撑确认流程（例如 `USER.md` 仅模板占位）。

执行目标：

- 通过 Wizard 完成最小用户画像建档（称呼、语言、风格、基础协作约定）。
- 仅采集必要字段，避免一次性冗长问卷。

### 3.2 模式二：Metadata Guided（有 metadata）

触发条件（建议）：

- `.openloom/metadata/` 有有效数据，或
- 最近一次 profile build 已产出候选事实/冲突。

执行目标：

- 不要求用户重复输入已抽取信息。
- 通过对话完成：
  - 关键信息确认
  - 缺失信息补充
  - 冲突项澄清与决策

---

## 4. 模式路由设计（Bootstrap Router）

新增统一判定函数（建议命名：`detectBootstrapMode()`）：

输入信号：

- metadata 可用性（目录存在且有可消费文件）
- `USER.md` 完整度（模板占位 vs 已有稳定内容）
- `workspace-state.json` 生命周期字段
- 冲突积压状态（`USER_CONFLICTS.md` 是否有待确认项）

输出：

- `interactive_blank`
- `metadata_guided`
- `normal_chat`（已完成 onboarding 且无待确认阻塞项）

路由原则：

- 优先避免让用户重复输入。
- 关键冲突优先处理，再进入常规对话。

---

## 5. 对话状态机（CLI 先行）

统一状态机（两种模式共用）：

1. `cold_start_entry`
2. `mode_routing`
3. `onboarding_blank` 或 `onboarding_guided`
4. `conflict_resolution`（按需）
5. `onboarding_finalize`
6. `normal_chat`

### 5.1 模式一（无 metadata）步骤

1. 基础偏好采集（称呼/语言/语气/输出习惯）
2. 最小事实建档（仅必要字段）
3. 回显确认（用户确认写入内容）
4. 写入记忆文件 + 状态推进

### 5.2 模式二（有 metadata）步骤

1. 展示高置信候选事实（分批，不一次性塞满）
2. 让用户逐批确认/修正
3. 对冲突项逐条确认（关键冲突强制确认）
4. 写入确认后的事实与规则
5. 未确认项继续保留在冲突文件中

---

## 6. 文件职责与更新策略

### 6.1 `USER.md`

- 存放用户稳定画像与关键确认事实。
- `General` 仅保留稳定身份层，不放高波动摘要。

### 6.2 `USER_CONFLICTS.md`

- 存放冲突候选、置信度分布、推荐值与待确认状态。
- 模式二优先消费该文件中的 `pending`。

### 6.3 `SOUL.md`

- 存放对话风格、输出偏好、协作约定。

### 6.4 `lessons.md`

- 用户纠正后的规则沉淀（同类冲突冻结、偏好修正等）。
- 仅追加更新日志，不覆盖历史记录。

### 6.5 `workspace-state.json`

- 增加/维护如下字段（建议）：
  - `bootstrapMode`
  - `onboardingStage`
  - `onboardingCompletedAt`
  - `lastWizardRunAt`
  - `lastWizardSource`
  - `pendingConflictCount`

---

## 7. CLI 交互方案（MVP）

建议命令与行为：

- `openloom setup`
  - 调起 Bootstrap Router
  - 自动选择模式一或模式二
  - 走对应 Wizard 流程直至完成

- `openloom profile build`
  - 负责离线批处理构建（已有）

- `openloom profile reset`
  - 负责冷启动还原（已有）

- 可选新增：`openloom onboarding resume`
  - 用于恢复未完成 onboarding 会话

交互原则：

- 每轮问题要短，减少用户负担。
- 模式二优先“确认式问题”，避免“重新填写式问题”。

---

## 8. 与现有实现的衔接点

优先复用：

- `src/wizard/session.ts`
- `src/wizard/onboarding.ts`
- `src/config/agent-memory/bootstrap-files.ts`
- `src/config/workspace-state.ts`
- `src/profile/*`（构建与冲突能力）

建议新增或改造：

- 新增 `src/wizard/bootstrap-mode.ts`（模式判定）
- 新增 `src/wizard/onboarding-guided.ts`（模式二对话编排）
- 改造 `src/cli/commands/setup.ts`（接入模式路由）
- 新增/改造冲突确认编排模块（消费 `USER_CONFLICTS.md`）

---

## 9. 分阶段实施计划

## Phase 1（P0）：双模式路由 + CLI 基础流程

- [ ] 实现 `detectBootstrapMode()`
- [ ] 在 `setup` 接入模式路由
- [ ] 模式一沿用并收敛现有 onboarding 问题集
- [ ] 新增模式二基础确认流程（高置信事实确认）
- [ ] 更新 `workspace-state.json` 的阶段字段

验收：

- [ ] metadata 为空时进入模式一
- [ ] metadata 存在时进入模式二
- [ ] 两种模式都能完成并落盘

## Phase 2（P0）：冲突确认闭环

- [ ] 增加冲突分级（关键/非关键）
- [ ] 模式二中优先处理关键冲突
- [ ] 用户确认结果回写 `USER.md` 与 `USER_CONFLICTS.md`
- [ ] 同类冲突规则写入 `lessons.md`

验收：

- [ ] 关键冲突不会静默覆盖
- [ ] 未确认冲突保留 pending 状态
- [ ] 用户纠正后同类处理一致

## Phase 3（P1）：可恢复会话与 UI 适配准备

- [ ] 增强 WizardSession 恢复点（基于 `onboardingStage`）
- [ ] 统一 CLI 与未来 UI 的 wizard 协议语义
- [ ] 抽离通用步骤定义，减少 CLI/UI 双维护

验收：

- [ ] 中断后可恢复到上一个阶段
- [ ] CLI 与 UI 使用同一状态机语义

---

## 10. 验证清单（发布前）

- [ ] `openloom profile reset` 后，模式判定正确回到模式一。
- [ ] 导入 metadata 后，模式判定正确进入模式二。
- [ ] 模式二不会重复询问已高置信且已确认信息。
- [ ] `General` 区块不因普通对话频繁波动。
- [ ] 所有关键更新均可追溯到用户确认或证据来源。

---

## 11. 后续 UI 扩展策略

CLI 与 UI 共用同一个 WizardSession 协议：

- UI 只负责渲染 step（note/select/text/confirm）
- 业务决策仍在状态机与编排层
- 避免把对话逻辑散落到前端

这样可以保证：

- 先用 CLI 跑通逻辑和验收
- 后续切 UI 时不重写核心流程

---

## 12. 结论

本方案通过“双模式冷启动 + 统一状态机 + 记忆分责文件 + 冲突确认回路”，在不破坏现有 metadata 构建能力前提下，实现了与 OpenClaw 风格一致的 Agent-User 交互路径。

实施顺序建议严格按 Phase 1 -> 2 -> 3 推进，先完成 CLI 闭环，再扩展 UI。

---

## 13. Phase 1 详细实施清单（文件级）

本节作为直接执行清单，要求全部遵循 OpenClaw 风格：wizard 驱动、状态文件驱动、记忆分文件管理、增量合并更新。

### 13.1 代码改造清单

1) `src/wizard/bootstrap-mode.ts`（新增）

- [ ] 定义 `BootstrapMode`：
  - `interactive_blank`
  - `metadata_guided`
  - `normal_chat`
- [ ] 实现 `detectBootstrapMode(openloomDir)`：
  - 检查 `.openloom/metadata` 是否有有效输入
  - 检查 `USER.md` 是否仍为模板/低信息状态
  - 检查 `workspace-state.json` 是否完成 onboarding
  - 检查 `USER_CONFLICTS.md` 是否有待确认关键冲突
- [ ] 返回判定结果 + 判定理由（用于日志与后续调试）

2) `src/wizard/onboarding.ts`（改造）

- [ ] 保留模式一问题集（简洁、最小化）
- [ ] 增加可复用步骤定义（避免 CLI 与 UI 双写）
- [ ] 输出结构化结果，便于统一写入 `USER/SOUL/lessons`

3) `src/wizard/onboarding-guided.ts`（新增）

- [ ] 实现模式二确认流程编排：
  - 高置信事实分批确认
  - 缺失字段定向补问
  - 冲突项逐条确认（关键冲突优先）
- [ ] 对每条确认结果产出统一动作：
  - `accept`
  - `correct`
  - `skip`
  - `defer`

4) `src/cli/commands/setup.ts`（改造）

- [ ] setup 启动时先调用 `detectBootstrapMode()`
- [ ] 根据模式路由到：
  - 模式一：`runOnboardingWizard()`
  - 模式二：`runGuidedOnboardingWizard()`
- [ ] 统一收口到 `onboarding_finalize`：
  - 写记忆文件
  - 更新 `workspace-state`
  - 输出摘要结果

5) `src/config/workspace-state.ts`（改造）

- [ ] 扩展状态字段：
  - `bootstrapMode`
  - `onboardingStage`
  - `pendingConflictCount`
- [ ] 增加阶段推进 helper（避免命令层直接拼状态）

6) `src/profile/io.ts` 或新增 `src/profile/conflict-resolution.ts`（二选一）

- [ ] 提供“确认结果回写”能力：
  - 更新 `USER.md` 已确认事实
  - 更新 `USER_CONFLICTS.md` 状态（pending -> resolved/deferred）
  - 写入置信度与用户决策说明

7) `src/config/agent-memory/*`（小幅改造）

- [ ] 将模式二中的用户确认规则写入 `lessons.md`
- [ ] 对同类冲突规则支持复用（例如并行角色软冲突默认不阻断）

### 13.2 测试清单

1) 单元测试

- [ ] `src/wizard/bootstrap-mode.test.ts`
  - metadata 为空 -> `interactive_blank`
  - metadata 存在 -> `metadata_guided`
  - onboarding 已完成且无 pending -> `normal_chat`
- [ ] `src/wizard/onboarding-guided.test.ts`
  - 确认/修正/跳过/延后动作输出正确
- [ ] `src/config/workspace-state.test.ts`
  - 新增字段读写与默认值兼容

2) 集成测试

- [ ] `src/e2e/integration.test.ts` 增加场景：
  - reset 后 setup 走模式一
  - build 后 setup 走模式二
  - 模式二确认冲突后文件状态正确更新

3) 手动验收

- [ ] CLI 模式一全流程录屏或日志留档
- [ ] CLI 模式二全流程录屏或日志留档
- [ ] 中断恢复后继续完成 onboarding

### 13.3 执行顺序（建议）

1. 先完成 `bootstrap-mode.ts` 与状态字段扩展。  
2. 再接入 `setup.ts` 路由，不改冲突回写。  
3. 再实现 `onboarding-guided.ts` 与冲突确认回写。  
4. 最后补齐单测、集成测试与手动验收记录。  

### 13.4 完成定义（DoD）

- [ ] `setup` 能自动选择双模式并完成流程  
- [ ] 模式二不再要求用户重复输入已知信息  
- [ ] 关键冲突必须确认后才更新 `USER.md`  
- [ ] `workspace-state` 可用于恢复与审计  
- [ ] 所有新增逻辑有对应测试覆盖  
