# OpenLoom UI 使用说明 v2（React + TypeScript）

## 启动

1. 在仓库根目录运行：
   - `npm run ui-ts:build`
   - PowerShell:
     - `$env:OPENLOOM_UI_DIR="D:/repo/monorepo/OpenLoom/ui-ts/dist"`
     - `npm run serve`
2. 浏览器打开：
   - `http://localhost:3000`

## 页面说明

## 1) Extract

- 填写 `Target File or Directory`
- 可选参数：
  - `Force re-extract`
  - `Skip face detection`
  - `OCR Provider`
  - `OpenLoom Directory`
- 点击 `Start Extract` 后，进度会实时显示在 `Progress` 面板

## 2) Metadata List

- 支持按类型筛选：`text_doc` / `image`
- 支持关键词搜索：文件名、summary、entities
- 点击任意行进入 Metadata Detail

## 3) Metadata Detail

- 展示完整 metadata JSON（含 `path_history`、`extraction_errors`）
- 点击 `Open in Human Review` 进入人工校对页

## 4) Human Review

- 可编辑：
  - `summary`
  - `keywords`
  - `entities`（persons/places/orgs/other）
  - `spatiotemporal`（JSON）
  - `people_annotations`（JSON）
  - `review notes`
- 保存时会写回 metadata 文件，并自动写入：
  - `human_review.reviewed = true`
  - `human_review.reviewed_at`

## 冲突处理

- 若 metadata 在你编辑期间被其他操作更新，保存会返回冲突错误：
  - `Save conflict: metadata has changed on disk, please reload before saving`
- 处理方式：回到 Detail/List 重新加载后再编辑。
