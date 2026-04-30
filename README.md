# 默 (Mo) — 英语背单词 PWA

> 安静地记单词。Apple 式极简黑白风格，四轮递进学习流程，基于间隔重复。

## 技术栈

| 层面 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| PWA | vite-plugin-pwa (Workbox) |
| 存储 | IndexedDB (idb) |
| 发音 | Web Speech API |
| AI 释义 | DeepSeek API |
| 样式 | 原生 CSS + CSS Variables |

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 项目结构

```
mo/
├── public/
│   ├── icon-192.png / icon-512.png   ← 应用图标
│   └── data/
│       ├── cet4.json    (4,544 词)
│       ├── cet6.json    (3,992 词)
│       ├── kaoyan.json  (5,047 词)
│       └── toefl.json   (10,367 词)
├── scripts/
│   ├── prepare-vocab.mjs     ← 词库数据处理脚本
│   ├── generate-icons.mjs    ← PNG 图标生成脚本
│   └── generate-icons.html   ← 浏览器图标生成器
├── src/
│   ├── App.tsx               ← 根组件 / 视图路由
│   ├── main.tsx
│   ├── types/index.ts        ← 全局类型
│   ├── styles/global.css     ← 全局样式
│   ├── lib/
│   │   ├── db.ts             ← IndexedDB 封装
│   │   ├── scheduler.ts      ← 间隔重复算法
│   │   └── ai.ts             ← DeepSeek API
│   ├── hooks/
│   │   ├── useStudySession.ts ← 学习状态机
│   │   ├── useWordbook.ts    ← 词库管理
│   │   └── useSpeech.ts      ← 发音
│   └── components/
│       ├── Welcome.tsx        ← 首次欢迎页
│       ├── CardDisplay.tsx    ← ROUND_1 首次相遇
│       ├── CardRecall.tsx     ← ROUND_2 主动回忆
│       ├── CardCloze.tsx      ← ROUND_3 语境填空
│       ├── CardConfirm.tsx    ← ROUND_4 最终确认
│       ├── ReviewCard.tsx     ← 复习卡片
│       ├── DaySummary.tsx     ← 每日总结
│       ├── StatsPanel.tsx     ← 统计面板
│       ├── Settings.tsx       ← 设置页
│       ├── SpeakButton.tsx    ← 发音按钮
│       ├── ProgressDots.tsx   ← 进度点
│       └── AiExplain.tsx     ← AI 释义
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 学习流程

```
REVIEW → ROUND_1 (首次相遇) → ROUND_2 (主动回忆) → ROUND_3 (语境填空) → ROUND_4 (最终确认) → SUMMARY
```

- **REVIEW**: 复习到期旧词（中文→英文 / 例句填空）
- **ROUND_1**: 浏览新词，建立第一印象
- **ROUND_2**: 看中文回忆英文，标记困难词
- **ROUND_3**: 仅对困难词例句填空，不做对错判断
- **ROUND_4**: 最终确认今日所有新词

## 间隔重复

| 阶段 | 间隔 |
|------|------|
| 0 | 当天 |
| 1 | 1 天后 |
| 2 | 3 天后 |
| 3 | 7 天后 |
| 4 | 14 天后 |
| 5 | 毕业 |

- 答对 → 阶段 +1
- 答错 → 回退到阶段 1
- 连续 2 次答错 → 标记为顽固词（优先复习）

## 词库数据处理

```bash
# 1. 从 jsDelivr CDN 下载原始数据到 temp_vocab/
#    数据源: KyleBing/english-vocabulary (json-sentence 版本)

# 2. 运行处理脚本
node scripts/prepare-vocab.mjs

# 输出: public/data/cet4.json, cet6.json, kaoyan.json, toefl.json
```

## 部署到 Vercel

1. 将项目推送到 GitHub
2. 在 Vercel 中导入项目
3. 框架预设选择 **Vite**
4. 构建命令: `npm run build`
5. 输出目录: `dist`
6. 部署完成后访问分配域名

## iPhone 添加到主屏幕

1. Safari 中打开部署后的 URL
2. 点击底部「分享」按钮（↑）
3. 选择「添加到主屏幕」
4. 确认名称「默」，点击「添加」
5. 主屏幕出现「默」图标，点击即可作为独立 App 使用

## 已知限制

1. **图标为白色占位图**：需在浏览器中打开 `scripts/generate-icons.html` 生成带「默」字的正式图标，替换 `public/icon-192.png` 和 `public/icon-512.png`
2. **AI 释义需要联网**：需要用户自行填写 DeepSeek API Key
3. **Web Speech API**：部分浏览器/系统可能不支持离线语音（iOS Safari 支持的语音较少）
4. **词库导入导出**：导入会完全覆盖当前进度
5. **触控手势**：左右滑动在部分 Android 浏览器上可能冲突
