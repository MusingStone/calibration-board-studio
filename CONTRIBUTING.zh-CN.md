# 贡献指南

简体中文 · [English](CONTRIBUTING.md)

欢迎提交 Issue 与 PR。物理几何统一使用毫米；修改标记编码或布局时，请注明对应识别器采用的约定。问题请公开讨论；安全问题通过维护者的 GitHub 主页私下反馈，不要提交公开 Issue。

## 本地检查

```bash
npm ci
npm run build
```

| 命令 | 作用 |
| --- | --- |
| `npm run build` | TypeScript 检查 + Vite 生产构建 |

仅在码字需要更新时运行 `python3 scripts/generate_markers.py`，提交前检查生成文件差异。

## 新增或修改标定板

1. 在 `src/core/plugins.ts` 新增或修改 `BoardPlugin`：参数字段、默认值、`size`、`generate`、`validate`，按需提供 `annotation` 与 `metadata`。
2. 以标定板局部毫米坐标生成图元。标记的码字、边框与比特顺序必须符合目标识别器；不要依赖预览像素或画布缩放。
3. 明确原点与 ID 顺序。识别器有固定约定时把它设为默认值，并在界面与文档中解释其他选择。
4. 带编码标记的图案请提供 `markers(params)`（`{ id, x, y, size }`）：ID 标注子图层依赖它。`gridSpots` / `charucoIds` / `aprilSpots` 展示了如何让 `generate` 与 ID 布局共用同一份数据，避免图案与编号脱节。单码用 `single: true` 标记，并用 `zAxis` 字段确定坐标系。
5. 默认尺寸与行列数要保证「图案 + 坐标轴 + 参数标签」能放进横版 A4。
6. 功能或限制发生用户可见变化时，同时更新中英文 README。

约定速记：ArUco 单码使用 OpenCV 的标记系（X 向右、Y 向上、Z 指向标记外）；AprilTag 单码按官方 AprilRobotics 方向绘制，AprilTag 库报告的是 X 向右、Y 向下、Z 指向标记内；两者都是右手系，相差绕 X 轴 180° 旋转。ChArUco 默认左上角为 ArUco 标记（OpenCV 4.6 之前／`setLegacyPattern(true)`）。Kalibr 的 AprilGrid 检测器假定 tag36h11 与左下角原点，改成其他 family 或原点前必须先用目标识别器验证。

## 界面改动

- 界面文字集中在 `src/i18n.tsx`：单条文案改 `english` 词典；由数值拼出的文案（数量、图层名、吸附关系）改 `translateText` 里的正则链。注意 `translateText` 会**先**处理 `名称：详情` 形式，因此拼接句子请用 ` · ` 而不是全角冒号，否则不会走到你的规则。
- 面板保持独立组件（`LayerPanel`、`LayoutPanel`、`LayoutTools`、`DimensionInspector`），让各面板职责清晰。
- 属性栏只在「未选中任何对象」时显示页面设置；对象面板归各自对象所有。
- 标定图案与坐标轴、参数标签、ID 标注子图层保持独立；画布与所有导出路径必须共用同一份场景数据。
- 核心模块保持纯函数：`snap.ts`、`naming.ts`、`paper.ts`、`layout.ts`，以及 `scene.ts`、`plugins.ts` 中的几何辅助函数。
- 中英文 README 保持一一对应：小节与顺序一致，并在同一次改动里同步更新。

## 项目结构

`src/core/model.ts` 是唯一事实来源，`src/core/project.ts` 按它校验导入文件，包括每个插件字段、三个子图层以及尺寸线的可选样式。结构变化时请提升 `documentVersion`——本项目不提供迁移，版本不符的文件会被拒绝。

## 依赖与来源

引入依赖或素材前先核查其使用条款。左上角图标是代码绘制的原创 SVG。新增码字、图片、标志或字体时，请在 `THIRD_PARTY_NOTICES.md` 记录来源与许可证。若依赖会进入打包产物，还需登记到 `scripts/generate_notices.mjs`，运行 `npm run notices` 刷新 `public/third-party-notices.txt`，构建时会复制到 `dist/`。

## PR 说明

请说明用户可见的变化、涉及的识别器或坐标约定，以及运行过的检查。视觉改动请附前后截图；修改 PDF、SVG 或 PNG 渲染时请附示例导出。
