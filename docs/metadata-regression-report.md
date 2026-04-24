# OpenLoom Metadata Regression Report

## 1. 执行概览

- 执行时间（UTC）：`2026-04-24T12:23:57.017Z`
- 执行模式：完整 E2E（真实提取链路）
- 测试脚本：`scripts/metadata-regression.ts`
- 隔离运行目录：`.tmp/metadata-regression/.openloom`
- 样本来源目录：`data/fanyang`

## 2. 样本清单

- `md`：`OpenLoom架构设计方案_v1.md`
- `docx`：`FanYang_CV_2025.docx`
- `jpg`：`IMG_20210927_082112.jpg`

## 3. 覆盖矩阵

| 文件类型 | 首次提取 | hash-skip | rename/move + path_history | --force 重提取 | 文档对齐(created_at) |
|---|---|---|---|---|---|
| md | PASS | PASS | PASS | PASS | PASS（刷新） |
| docx | PASS | PASS | PASS | PASS | PASS（刷新） |
| jpg | PASS | PASS | PASS | PASS | PASS（保留） |

## 4. 断言统计

- 总断言数：`21`
- 通过：`21`
- 失败：`0`
- 通过率：`100%`

## 5. 关键行为验证结果

### 5.1 hash-skip 行为

结论：通过。三类文件在二次提取（不带 `--force`）时均保持 `hash` 与 `extracted_at` 不变，符合缓存命中预期。

### 5.2 rename/move + path_history 行为

结论：通过。三类文件改名/移动后：

- `file_path` 更新为新路径
- `path_history` 新增 1 条历史记录
- `extracted_at` 保持不变（未触发重提取）

### 5.3 --force 行为

结论：通过。三类文件在 `--force` 后均出现 `extracted_at` 变化，证明执行了重提取流程。

### 5.4 文档对齐（v1.3 created_at 语义）

为验证路径刷新策略中 `created_at` 的差异行为，测试在 Case 2 与 Case 3 之间对缓存元数据做了临时篡改（仅在隔离目录）：

- 篡改值：`1999-01-01T00:00:00.000Z`
- 期望：
  - `text_doc`（md/docx）在 location refresh 时应被当前文件属性覆盖
  - `image`（jpg）在 location refresh 时应保留缓存 `created_at`

结论：通过，行为与 `docs/元数据提取方案_v1.md` v1.3 一致。

## 6. 证据摘录

### md

- hash: `49e44770944bd09bca5502d119366a2bed5e383554c379aafe13ca143dd09b17`
- metadata: `.tmp/metadata-regression/.openloom/metadata/text_docs/49e44770944bd09bca5502d119366a2bed5e383554c379aafe13ca143dd09b17.md`
- extracted_at: `2026-04-24T12:22:26.451Z` (case1/2/3) -> `2026-04-24T12:22:48.475Z` (case4 force)
- path_history after move: `1`
- created_at after move: `2026-04-24T12:10:06.157Z` (已从篡改值刷新)

### docx

- hash: `6fab25e033e949fb5139f22825d25632bb49540c5912884827fcb59e95c74c22`
- metadata: `.tmp/metadata-regression/.openloom/metadata/text_docs/6fab25e033e949fb5139f22825d25632bb49540c5912884827fcb59e95c74c22.md`
- extracted_at: `2026-04-24T12:23:08.839Z` (case1/2/3) -> `2026-04-24T12:23:25.133Z` (case4 force)
- path_history after move: `1`
- created_at after move: `2025-07-30T01:40:21.200Z` (已从篡改值刷新)

### jpg

- hash: `99bdfc10f407f7c11140f03561e85dd02c6f5061fa0d3d0e26faaf17738a4339`
- metadata: `.tmp/metadata-regression/.openloom/metadata/images/99bdfc10f407f7c11140f03561e85dd02c6f5061fa0d3d0e26faaf17738a4339.md`
- extracted_at: `2026-04-24T12:23:42.213Z` (case1/2/3) -> `2026-04-24T12:23:57.014Z` (case4 force)
- path_history after move: `1`
- created_at after move: `1999-01-01T00:00:00.000Z` (按预期保留)

## 7. 结论

本次元数据回归测试覆盖 `md/docx/jpg` 与核心行为（hash-skip、路径刷新、force、文档语义对齐），全部通过。  
在当前样本与执行环境下，Phase 2 元数据探查链路达到可收敛状态，可进入提交收敛与阶段收官评审。
