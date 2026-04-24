# OpenLoom UI 验收回归清单 v2（React + TypeScript）

## 环境准备

- [ ] `npm run ui-ts:build` 构建成功
- [ ] 使用 TS 前端产物启动网关：
  - PowerShell：`$env:OPENLOOM_UI_DIR="D:/repo/monorepo/OpenLoom/ui-ts/dist"; npm run serve`
- [ ] 浏览器可访问 `http://localhost:3000`（页面标题为 OpenLoom React + TypeScript MVP）
- [ ] 已有至少 1 条 text_doc 和 1 条 image metadata

## A. Extract 控制台

- [ ] 输入目录后可成功触发提取
- [ ] 进度面板能显示实时 `extract.progress`
- [ ] 提取完成后返回成功摘要（成功/失败/耗时）
- [ ] 错误路径时显示可读错误信息

## B. Metadata List

- [ ] 可按文件类型筛选（all/text_doc/image）
- [ ] 关键词搜索可生效
- [ ] 空结果时显示 `No metadata found`
- [ ] 点击行可进入详情页

## C. Metadata Detail

- [ ] 能展示完整 JSON
- [ ] 包含 `path_history` 时可见对应内容
- [ ] 包含 `extraction_errors` 时可见对应内容
- [ ] 可通过按钮跳转 Human Review

## D. Human Review

- [ ] 可编辑 summary 并保存
- [ ] 可编辑 entities 并保存
- [ ] 可提交 `spatiotemporal` JSON（confidence 0~1）
- [ ] 非法 JSON 会触发校验错误
- [ ] 保存成功后列表 `reviewed` 状态更新
- [ ] 保存后 Detail 页内容同步更新

## E. 冲突与健壮性

- [ ] 两个页面同时编辑同一条 metadata，后保存者收到冲突提示
- [ ] WebSocket 断开后界面显示 disconnected，恢复后自动 reconnect
- [ ] 所有关键操作错误都能在页面可见，不出现静默失败
