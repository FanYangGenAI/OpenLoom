# OpenLoom Agentic OpenClaw 对齐实施任务单 v1

## 1. 目标与边界

本任务单用于把 OpenLoom 中所有 Agentic agent 相关能力，对齐到 OpenClaw 风格实现逻辑：

- Wizard 驱动（统一交互抽象）
- Workspace bootstrap 记忆文件体系
- 独立 onboarding 状态文件
- 增量记忆合并（非整文件覆盖）
- 交互式提取与 onboarding 共用状态机

非目标（本轮不做）：

- 不改现有 metadata 文件格式（`.openloom/metadata/*`）
- 不引入数据库迁移
- 不在本轮做 UI 全量重构（先 CLI 跑通）

---

## 2. 里程碑规划

## M1：Wizard 与状态骨架落地（优先级 P0）

目标：把 onboarding 从“命令式问答”升级为“wizard 状态机”。

### 2.1 新增/改造文件

- 新增 `src/wizard/prompts.ts`
- 新增 `src/wizard/session.ts`
- 新增 `src/wizard/onboarding.ts`
- 新增 `src/config/workspace-state.ts`
- 改造 `src/cli/commands/setup.ts`
- 轻改 `src/cli/commands/extract.ts`（复用 onboarding 入口）

### 2.2 实施任务

- 定义 `WizardPrompter` 抽象（note/select/text/confirm/progress）。
- 增加 `WizardSession`（next/answer/cancel）以支持 CLI 与未来 UI 复用。
- setup 改为调用 `runOnboardingWizard()`。
- 新增 `workspace-state.json` 读写工具：
  - `bootstrapSeededAt`
  - `onboardingCompletedAt`
  - `lastWizardRunAt`
  - `lastWizardSource`
- 未完成 onboarding 时，`extract --interactive` 自动引导到 onboarding。

### 2.3 验收标准

- `openloom setup` 可在 wizard 里完整走完并成功退出。
- 再次执行 setup 时可识别已有状态并走“更新路径”。
- `extract --interactive` 在未完成 onboarding 时自动转 setup，不中断流程。

### 2.4 回滚策略

- 保留旧 `setup` 入口函数（以 feature flag 或保留 fallback 分支）。
- `workspace-state` 读取失败时降级为“未完成 onboarding”而非崩溃。

---

## M2：Bootstrap 记忆文件体系（优先级 P0）

目标：引入 OpenClaw 风格的记忆模板文件，并建立首次 seed 流程。

### 3.1 新增/改造文件

- 新增 `src/config/agent-memory/bootstrap-templates.ts`
- 新增 `src/config/agent-memory/bootstrap-files.ts`
- 新增 `.openloom/agent/templates/BOOTSTRAP.md`（运行时模板来源可放代码常量）
- 新增 `.openloom/agent/templates/IDENTITY.md`
- 新增 `.openloom/agent/templates/USER.md`
- 新增 `.openloom/agent/templates/SOUL.md`
- 改造 `src/config/lessons-memory.ts`

### 3.2 实施任务

- 实现 `ensureAgentBootstrapFiles(openloomDir)`：
  - 若文件不存在则 seed
  - 若存在则不覆盖
- 首轮 onboarding 问答结果同步写入：
  - `IDENTITY.md`
  - `USER.md`
  - `SOUL.md`
  - `lessons.md`
- 增加 `BOOTSTRAP.md` 生命周期策略：
  - MVP：完成后保留并写入 completed 标记（先不删除）

### 3.3 验收标准

- 首次 setup 后 5 个文件均存在。
- 重复 setup 不会覆盖用户手工编辑的非目标字段。
- `lessons.md` 与 `USER/IDENTITY/SOUL` 内容一致性可核对。

### 3.4 回滚策略

- seed 只用 `write-if-missing`，确保回滚仅需删除新建文件。
- 若同步写入多文件失败，记录错误并至少保证 `lessons.md` 可用。

---

## M3：非覆盖记忆合并策略（优先级 P0）

目标：把 `lessons.md` 从整文件覆盖改为字段级合并。

### 4.1 新增/改造文件

- 新增 `src/config/agent-memory/lessons-parser.ts`
- 新增 `src/config/agent-memory/lessons-merge.ts`
- 改造 `src/config/lessons-memory.ts`
- 新增测试 `src/config/agent-memory/*.test.ts`

### 4.2 实施任务

- 实现 `parseLessons(content)`：
  - 分节解析 `UserProfile/CommunicationStyle/WorkingAgreements/UpdateLog`
- 实现 `mergeLessons(existing, incoming)`：
  - `skip/empty` 不覆盖已有值
  - `pending` 仅在缺失时补位
  - `WorkingAgreements` 去重并集
  - `UpdateLog` 仅 append
- 实现原子写：
  - `write tmp -> rename`

### 4.3 验收标准

- 连续两次 setup，第二次仅改一项时其余字段不丢失。
- 用户手工改动后再执行 setup，不会被整文件覆盖。
- 并发写失败时不会产生损坏文件。

### 4.4 回滚策略

- 解析失败 fallback：备份原文件后重建并记录 `parse_recovered` 日志。
- 保留旧写入函数作为紧急兜底（仅 debug 用）。

---

## M4：Root 与交互提取统一到 Wizard（优先级 P1）

目标：`roots` 与 `extract --interactive` 共用 wizard 交互语义。

### 5.1 新增/改造文件

- 改造 `src/cli/commands/roots.ts`
- 改造 `src/cli/commands/extract.ts`
- 新增 `src/wizard/extract-interactive.ts`

### 5.2 实施任务

- `extract --interactive` 使用 wizard prompter，不再直接 readline 拼接。
- root 读取逻辑统一经过 `workspace-state + user-settings`。
- 支持“保存本次提取偏好为默认值”。

### 5.3 验收标准

- 交互提取文案一致、支持 skip/默认值回显。
- 非交互 `extract` 行为保持兼容。

### 5.4 回滚策略

- 保留非交互参数路径不变，interactive 分支可独立关闭。

---

## M5：Skills 对齐与契约化（优先级 P1）

目标：将 3 个编排型 skill 与实际 wizard/state 实现对齐。

### 6.1 新增/改造文件

- 改造 `skills/bootstrap-cold-start/SKILL.md` + `scripts/run.js`
- 改造 `skills/root-dir-manager/SKILL.md` + `scripts/run.js`
- 改造 `skills/interactive-extract/SKILL.md` + `scripts/run.js`

### 6.2 实施任务

- 将脚本从占位输出改为真实调用 CLI/模块。
- 明确 JSON contract（输入/输出/错误码）。
- 在 SKILL.md 中写清触发场景和失败处理。

### 6.3 验收标准

- 三个 skill 均可输出稳定 JSON，字段与 CLI 结果一致。
- 错误路径可预测（缺配置、路径不存在、权限错误）。

### 6.4 回滚策略

- 若 skill 执行失败，CLI 仍可直接使用，skill 仅作为编排层。

---

## M6：测试与发布门禁（优先级 P0）

目标：确保对齐改造不引入回归。

### 7.1 自动化测试任务

- 新增 `wizard` 单测：
  - session 生命周期
  - cancel/confirm/select 行为
- 新增 `workspace-state` 单测
- 新增 `bootstrap-files` 单测（write-if-missing）
- 新增 `lessons merge` 单测（非覆盖）
- 扩展 CLI 集成测试：
  - 首次 setup 产物
  - 重复 setup 合并行为
  - extract 自动 onboarding

### 7.2 手动验收任务（Windows 优先）

- 对话体验（文案、默认值、skip）
- 产物完整性（5 个 agent 记忆文件 + 2 个状态配置文件）
- 兼容性（非交互提取、历史 metadata）

### 7.3 回滚策略

- 每个里程碑独立 PR，支持逐里程碑回退。
- 引入 feature flags：
  - `OPENLOOM_WIZARD_ENABLED`
  - `OPENLOOM_LESSONS_MERGE_V2`

---

## 3. TODO 列表（可直接执行）

## P0（必须）

- [ ] T1: 建立 `src/wizard` 抽象并接管 `setup`
- [ ] T2: 引入 `workspace-state.json` 与完成判定
- [ ] T3: 引入 bootstrap 文件 seed（BOOTSTRAP/IDENTITY/USER/SOUL）
- [ ] T4: 实现 `lessons.md` 字段级 merge（非覆盖）
- [ ] T5: `extract --interactive` 自动 onboarding 且不回归
- [ ] T6: 补齐单测与集成测试，形成 CI 可跑最小集合

## P1（强烈建议）

- [ ] T7: `extract --interactive` 全量迁移到 wizard prompter
- [ ] T8: roots 命令交互语义统一（与 wizard 同风格）
- [ ] T9: 三个 skill 从占位脚本升级为真实契约实现

## P2（后续优化）

- [ ] T10: bootstrap 完成后的生命周期策略（归档/只读标记）
- [ ] T11: Gateway/UI 端复用 WizardSession 协议
- [ ] T12: 多 root 与规则化 include/exclude 策略

---

## 4. 建议实施顺序（两周版本）

- Week 1: T1-T4（核心架构与记忆合并）
- Week 2: T5-T9（交互提取、skills、测试收敛）

建议以 4 个小 PR 推进：

1. `wizard + workspace-state`
2. `bootstrap files + lessons merge`
3. `interactive extract alignment`
4. `skills + tests + docs`

---

## 5. Staff Engineer 级检查清单

- 逻辑是否从“命令堆叠”转为“统一状态机”？
- 记忆写入是否避免覆盖用户手工编辑内容？
- onboarding 是否具备可恢复、可重入特性？
- 是否保留非交互路径，避免影响自动化？
- 是否每个里程碑都能独立回滚？
