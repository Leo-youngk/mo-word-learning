# Agent 任务指令：构建「默」(Mo) 英语背单词 PWA 应用

> 本文档是交给 AI Agent 的完整构建指令。请按照以下任务顺序，从零开始完成整个项目的搭建、开发、部署。

---

## 任务 0：理解你要构建的产品

你要构建一个名为「默」(Mo) 的英语背单词 PWA Web 应用。

**核心信息：**
- 产品名：默（Mo），取"默记"之意
- 类型：PWA（Progressive Web App），部署后可通过 iOS Safari "添加到主屏幕"当作原生 App 使用
- 用途：仅个人使用，每日背单词，支持离线运行
- 设计风格：Apple 式极简黑白风格，高级感、呼吸感、克制感
- 核心原则：打开即开始学习，学完即结束，没有多余的导航和选择

---

## 任务 1：获取并处理词库数据

### 1.1 下载原始数据

```bash
git clone https://github.com/KyleBing/english-vocabulary.git
```

### 1.2 定位数据文件

进入仓库中的 `json_original/` 目录。使用 `json-sentence` 子目录下的文件（该版本包含音标和例句）。

如果 `json-sentence` 目录不存在或数据不完整，则使用 `json-full` 子目录的数据。

需要处理的词库文件对应关系：
- 四级 → CET4 相关文件
- 六级 → CET6 相关文件
- 考研 → 考研相关文件
- 托福 → 托福相关文件

### 1.3 数据处理

编写一个 Node.js 脚本（或在构建时处理），将原始 JSON 转换为以下标准格式：

**每个词条的目标格式：**

```json
{
  "id": "cet6-abandon",
  "word": "abandon",
  "phoneticUs": "/əˈbændən/",
  "phoneticUk": "/əˈbændən/",
  "translations": [
    { "type": "v", "text": "放弃；遗弃；沉溺于" },
    { "type": "n", "text": "放任；狂热" }
  ],
  "phrases": [
    { "en": "abandon oneself to", "zh": "沉溺于；放纵" }
  ],
  "example": {
    "en": "He abandoned his wife and went away with all their money.",
    "zh": "他抛弃了妻子，带走了他们所有的钱。"
  }
}
```

**处理规则：**
- 为每个词条生成唯一 ID，格式：`{词库id}-{单词}`，如 `cet6-abandon`
- 去除释义为空的词条
- 音标缺失时填空字符串 `""`（发音功能用 TTS，不依赖音标）
- 词组只保留前 3 个
- 例句只保留 1 个；例句缺失时 `example` 字段设为 `null`
- 输出四个文件：`cet4.json`、`cet6.json`、`kaoyan.json`、`toefl.json`
- 放入项目的 `public/data/` 目录

---

## 任务 2：搭建项目工程

### 2.1 技术栈

| 层面 | 选择 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| PWA 支持 | vite-plugin-pwa |
| 本地存储 | IndexedDB（使用 `idb` 库） |
| 样式 | 原生 CSS + CSS Variables，不使用任何 UI 框架 |
| 部署 | Vercel |

### 2.2 项目结构

```
mo/
├── public/
│   ├── icon-192.png          ← 应用图标
│   ├── icon-512.png
│   └── data/
│       ├── cet4.json         ← 处理后的词库文件
│       ├── cet6.json
│       ├── kaoyan.json
│       └── toefl.json
├── src/
│   ├── App.tsx               ← 根组件，视图状态路由
│   ├── main.tsx              ← 入口
│   ├── styles/
│   │   └── global.css        ← 全局样式 + CSS Variables
│   ├── components/
│   │   ├── CardDisplay.tsx    ← 首次相遇卡片
│   │   ├── CardRecall.tsx     ← 主动回忆卡片（中→英）
│   │   ├── CardCloze.tsx      ← 语境填空卡片
│   │   ├── CardConfirm.tsx    ← 最终确认卡片
│   │   ├── ReviewCard.tsx     ← 复习卡片（复用 Recall 和 Cloze）
│   │   ├── DaySummary.tsx     ← 今日总结页
│   │   ├── StatsPanel.tsx     ← 统计面板（底部上滑）
│   │   ├── Settings.tsx       ← 设置页
│   │   ├── SpeakButton.tsx    ← 发音按钮组件
│   │   ├── ProgressDots.tsx   ← 底部进度指示点
│   │   ├── AiExplain.tsx      ← AI 释义组件（联网功能）
│   │   └── Welcome.tsx        ← 首次使用欢迎页
│   ├── hooks/
│   │   ├── useStudySession.ts ← 学习流程状态机
│   │   ├── useSpacedRepetition.ts ← 间隔重复逻辑
│   │   ├── useWordbook.ts     ← 词库加载与管理
│   │   └── useSpeech.ts       ← Web Speech API 封装
│   ├── lib/
│   │   ├── db.ts              ← IndexedDB 操作封装
│   │   ├── scheduler.ts       ← 每日队列生成算法
│   │   └── ai.ts              ← DeepSeek API 调用
│   └── types/
│       └── index.ts           ← 全局类型定义
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 任务 3：实现数据存储层

使用 IndexedDB 存储所有数据。使用 `idb` 库简化操作。

### 3.1 数据库定义

数据库名：`mo-db`，版本：`1`

**Object Store 1：`wordbooks`**

存储词库原始数据。Key: `bookId`

```typescript
interface WordbookRecord {
  bookId: string;           // "cet4" | "cet6" | "kaoyan" | "toefl"
  words: WordEntry[];       // 词条数组（上面定义的标准格式）
}
```

**Object Store 2：`progress`**

存储每个词的学习进度。Key: `wordId`

```typescript
interface ProgressRecord {
  wordId: string;              // "cet6-abandon"
  word: string;                // "abandon"
  bookId: string;              // "cet6"
  stage: number;               // 当前阶段 0-5（见间隔重复系统）
  nextReviewDate: string;      // ISO 日期 "2026-05-05"
  lastReviewDate: string;      // ISO 日期
  consecutiveCorrect: number;  // 连续答对次数
  consecutiveWrong: number;    // 连续答错次数
  totalReviews: number;        // 总复习次数
  totalCorrect: number;        // 总答对次数
  isStubborn: boolean;         // 是否为顽固词
  firstLearnDate: string;      // 首次学习日期
  graduated: boolean;          // 是否已毕业
}
```

**Object Store 3：`dailyLog`**

每日学习记录。Key: `date`

```typescript
interface DailyLogRecord {
  date: string;              // "2026-05-01"
  newWordsCount: number;
  reviewWordsCount: number;
  currentBookId: string;
}
```

**Object Store 4：`settings`**

用户设置。Key: `key`

```typescript
interface SettingsRecord {
  key: "settings";
  currentBookId: string;       // 当前词库 ID
  dailyMinNewWords: number;    // 每日最少新词数，默认 25
  currentWordIndex: number;    // 当前词库学到第几个词
  aiEnabled: boolean;          // AI 释义开关
  streakCount: number;         // 连续打卡天数
  lastStudyDate: string;       // 上次学习日期
  autoSpeak: boolean;          // 自动发音开关
}
```

**Object Store 5：`session`**

当前学习会话状态（用于中断恢复）。Key: `key`

```typescript
interface SessionRecord {
  key: "current";
  date: string;                // 会话日期
  phase: "review" | "round1" | "round2" | "round3" | "round4" | "summary";
  currentIndex: number;        // 当前轮次中的第几个词
  newWords: string[];          // 今日新词 ID 列表
  reviewWords: string[];       // 今日复习词 ID 列表
  round2Results: Record<string, boolean>;   // 第二轮结果 {wordId: 记得/不记得}
  round4Results: Record<string, boolean>;   // 第四轮结果
  reviewResults: Record<string, boolean>;   // 复习结果
}
```

---

## 任务 4：实现间隔重复系统

### 4.1 间隔定义

```typescript
const INTERVALS: Record<number, number> = {
  0: 0,    // 新词：当天
  1: 1,    // 1 天后
  2: 3,    // 3 天后
  3: 7,    // 7 天后
  4: 14,   // 14 天后
  5: -1,   // 毕业，不再复习
};
```

### 4.2 状态转移逻辑

```typescript
function handleReviewResult(progress: ProgressRecord, correct: boolean): ProgressRecord {
  if (correct) {
    // 答对：阶段 +1，重置连续答错
    const newStage = Math.min(progress.stage + 1, 5);
    const interval = INTERVALS[newStage];
    return {
      ...progress,
      stage: newStage,
      consecutiveCorrect: progress.consecutiveCorrect + 1,
      consecutiveWrong: 0,
      totalReviews: progress.totalReviews + 1,
      totalCorrect: progress.totalCorrect + 1,
      isStubborn: false,
      graduated: newStage === 5,
      lastReviewDate: today(),
      nextReviewDate: interval === -1 ? "" : addDays(today(), interval),
    };
  } else {
    // 答错：阶段重置为 1
    const newConsecutiveWrong = progress.consecutiveWrong + 1;
    return {
      ...progress,
      stage: 1,
      consecutiveCorrect: 0,
      consecutiveWrong: newConsecutiveWrong,
      totalReviews: progress.totalReviews + 1,
      isStubborn: newConsecutiveWrong >= 2,  // 连续两次答错 → 顽固词
      graduated: false,
      lastReviewDate: today(),
      nextReviewDate: addDays(today(), 1),   // 明天再来
    };
  }
}
```

### 4.3 每日队列生成

```typescript
function generateDailyQueue(allProgress: ProgressRecord[], bookWords: WordEntry[], currentIndex: number, minNewWords: number) {
  const today = getTodayString();

  // 1. 复习队列：所有 nextReviewDate <= today 且未毕业的词
  const reviewQueue = allProgress
    .filter(p => !p.graduated && p.nextReviewDate <= today)
    .sort((a, b) => {
      // 优先级：顽固词 > 阶段低的 > 阶段高的
      if (a.isStubborn !== b.isStubborn) return a.isStubborn ? -1 : 1;
      return a.stage - b.stage;
    });

  // 2. 新词队列：从 currentIndex 开始取，至少 minNewWords 个
  const newWords = bookWords.slice(currentIndex, currentIndex + minNewWords);

  return { reviewQueue, newWords };
}
```

---

## 任务 5：实现学习流程

### 5.1 流程状态机

每日学习由一个状态机驱动，状态按固定顺序推进：

```
REVIEW → ROUND_1 → ROUND_2 → ROUND_3 → ROUND_4 → SUMMARY
```

如果没有待复习的词，跳过 REVIEW 直接进入 ROUND_1。

**每次状态变更时，将当前会话状态写入 IndexedDB 的 `session` Store**，实现中断恢复。

### 5.2 阶段 REVIEW：复习到期旧词

**交互模式**：随机交替使用以下两种模式——

**模式 A：中文回忆英文**
- 显示：中文释义 + 词性
- 用户心里回忆 → 点击「查看答案」
- 显示：英文单词 + 音标 + 发音按钮
- 用户点击「记得」或「忘了」

**模式 B：例句填空**
- 显示：英文例句（目标词替换为 `______`）+ 中文释义提示
- 用户心里回忆 → 点击「查看答案」
- 显示：完整例句（目标词高亮）+ 单词 + 音标 + 发音按钮
- 用户点击「记得」或「忘了」

如果该词没有例句（`example === null`），则只使用模式 A。

**结果处理**：调用 `handleReviewResult()` 更新进度。

### 5.3 阶段 ROUND_1：首次相遇

**目的**：被动输入，建立第一印象。不做任何测试。

**卡片内容：**
- 英文单词（大号衬线体，36px，视觉焦点）
- 音标（16px，灰色 #888，显示在单词下方）
- 发音按钮（点击朗读。如果设置中开启了「自动发音」，进入时自动朗读一次）
- 词性 + 中文释义（18px）
- 分割线
- 一个核心例句：英文（目标单词加粗） + 中文翻译（如有例句时显示）
- 1-2 个常用词组（如有时显示）

**交互**：用户看完后点击「下一个」。

**流程**：连续过完至少 25 个新词。过完 25 个后，在底部出现两个选项：
- 「继续学习」→ 再加载更多新词
- 「进入下一轮」→ 进入 ROUND_2

### 5.4 阶段 ROUND_2：主动回忆（中 → 英）

**目的**：主动检索，强化记忆。覆盖 ROUND_1 中所有新词。

**卡片内容（答案隐藏状态）：**
- 中文释义 + 词性（居中显示，20px）
- 大量留白
- 底部：「查看答案」按钮

**卡片内容（答案显示后）：**
- 英文单词（淡入出现）+ 音标 + 发音按钮
- 中文释义
- 底部两个按钮：「不记得」（左） 「记得」（右）

**结果处理：**
- 「记得」→ 标记为"已初步掌握"
- 「不记得」→ 标记为"困难词"，进入 ROUND_3 的队列

### 5.5 阶段 ROUND_3：语境填空

**目的**：深度加工。仅处理 ROUND_2 中标记为"困难词"的单词。

如果 ROUND_2 中没有"困难词"，跳过此阶段直接进入 ROUND_4。

**卡片内容（答案隐藏状态）：**
- 英文例句，目标单词替换为 `______`
- 下方提示：中文释义
- 底部：「查看答案」按钮

如果该词没有例句，则降级为"再次展示完整卡片"（同 ROUND_1 的展示格式）。

**卡片内容（答案显示后）：**
- 完整例句（目标词高亮加粗）
- 单词 + 音标 + 发音按钮
- 底部：「下一个」按钮（不做对错判断，减少挫败感）

### 5.6 阶段 ROUND_4：当日最终确认

**目的**：最后快速巩固。覆盖今天所有新词。

**卡片内容（答案隐藏状态）：**
- 英文单词（大号显示）
- 音标 + 发音按钮
- 底部：点击任意位置翻转

**卡片内容（答案显示后）：**
- 英文单词 + 中文释义
- 底部两个按钮：「模糊」（左） 「记得」（右）

**结果处理：**
- 「记得」→ 创建 ProgressRecord，stage = 1，nextReviewDate = 明天
- 「模糊」→ 创建 ProgressRecord，stage = 1，nextReviewDate = 明天，并标记为优先复习

### 5.7 阶段 SUMMARY：今日总结

显示今日学习总结。详见 UI 设计部分。

写入 `dailyLog` 记录。更新 `settings` 中的 `currentWordIndex`、`streakCount`、`lastStudyDate`。清除 `session` 中的会话数据。

---

## 任务 6：实现发音功能

使用浏览器原生 Web Speech API，支持离线朗读。

```typescript
// src/hooks/useSpeech.ts

export function useSpeech() {
  const speak = (word: string) => {
    if (!window.speechSynthesis) return;
    // 取消正在播放的语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.85;   // 略慢，便于辨识
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  return { speak };
}
```

**SpeakButton 组件要求：**
- 使用一个极简的扬声器线条图标（SVG，自己画一个简单的扬声器图形即可，不要引入图标库）
- 图标大小 18px，颜色 #888
- 点击时 opacity 短暂降低到 0.4 再恢复（150ms）
- 点击调用 `speak(word)`

---

## 任务 7：实现 AI 释义功能（联网扩展）

### 7.1 功能定位

非核心功能。在联网时可用，离线时隐藏入口。

### 7.2 检测网络状态

```typescript
const isOnline = navigator.onLine;
// 同时监听 online/offline 事件动态更新
```

### 7.3 API 调用

使用 **DeepSeek API**（OpenAI 兼容格式）：

```typescript
// src/lib/ai.ts

const DEEPSEEK_API_KEY = "用户需要在设置中填入自己的 API Key";

export async function getAiExplanation(word: string): Promise<string> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content: `You are a concise English vocabulary tutor for a Chinese learner at upper-intermediate level. Explain the given word in 3 parts:
1. A one-sentence explanation in simple English (no Chinese)
2. One vivid, memorable example sentence using the word in a real-life context
3. A brief note on common usage patterns or easily confused words (in Chinese, within 20 characters)

Keep your total response under 80 words. Do not use bullet points or labels.`
        },
        {
          role: "user",
          content: word
        }
      ],
      stream: false,
      max_tokens: 200,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 7.4 API Key 管理

- 在设置页增加一个输入框：「DeepSeek API Key」
- API Key 存入 IndexedDB 的 `settings` Store
- 输入框类型为 `password`，内容脱敏显示
- 如果用户未填写 API Key，AI 释义入口不显示

### 7.5 UI 交互

- 在任何显示单词的卡片上，如果联网且已配置 API Key，在卡片底部显示「AI 释义」文字链接（颜色 #CCC，14px）
- 点击后发起 API 请求，显示加载状态：三个缓慢闪烁的点 `· · ·`
- 返回结果后，在卡片下方淡入展开 AI 解释文本（15px，#333）
- 离线时或未配置 Key 时，该链接不显示

---

## 任务 8：实现 UI 界面

### 8.1 视觉设计规范

**整体风格**：Apple 式极简黑白。没有圆角卡片、没有阴影、没有渐变、没有装饰线条。纯粹靠字体层级、留白、克制的排版来创造高级感。

**CSS Variables：**

```css
:root {
  /* 色彩 */
  --c-primary: #000000;
  --c-bg: #FFFFFF;
  --c-secondary: #333333;
  --c-tertiary: #888888;
  --c-quaternary: #CCCCCC;
  --c-divider: #E5E5E5;
  --c-surface: #FAFAFA;
  --c-success: #34C759;       /* 仅用于「记得」按钮的短暂反馈色 */
  --c-danger: #FF3B30;        /* 仅用于「重置数据」文字 */

  /* 字体 */
  --f-word: 'Georgia', 'Times New Roman', 'Noto Serif', serif;
  --f-body: -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;

  /* 字号 */
  --fs-word: 36px;
  --fs-phonetic: 16px;
  --fs-translation: 18px;
  --fs-example-en: 15px;
  --fs-example-zh: 14px;
  --fs-phrase: 14px;
  --fs-button: 16px;
  --fs-day: 48px;
  --fs-stat-num: 28px;
  --fs-stat-label: 14px;

  /* 间距 */
  --sp-xs: 4px;
  --sp-sm: 8px;
  --sp-md: 16px;
  --sp-lg: 24px;
  --sp-xl: 40px;
  --sp-2xl: 64px;
  --padding-h: 32px;
}
```

**全局样式要求：**
- `body` 背景纯白，无 margin
- 所有内容居中排列，最大宽度 480px（手机适配）
- 主内容区垂直居中偏上（距顶部约 25vh）
- 处理 iOS Safe Area：`padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)`

### 8.2 卡片布局规范

所有学习卡片共享相同的布局框架：

```
┌─────────────────────────────────┐
│         上方大量留白 (~25vh)      │
│                                 │
│       [主内容区 - 垂直居中]       │
│                                 │
│       [底部操作按钮 - 距底 15vh]  │
│                                 │
│       · · ● · ·  进度指示点      │
│                                 │
└─────────────────────────────────┘
```

### 8.3 各卡片详细 UI

**首次相遇卡片 (CardDisplay)**：
- 单词：36px 衬线体 #000，font-weight: 400
- 音标：16px 衬线体 #888，紧跟发音按钮
- 释义：18px 无衬线体 #000，按词性分行
- 分割线：1px #E5E5E5，水平宽度 60%
- 例句英文：15px #333，目标词 font-weight: 700
- 例句中文：14px #888
- 词组：14px #888，前缀 `▸`
- 底部按钮：「下一个」文字按钮

**主动回忆卡片 (CardRecall)**：
- 隐藏态：中文释义 20px 居中 + 大量留白 + 「查看答案」按钮
- 揭示态：单词淡入 (opacity 0→1, translateY 8px→0, 250ms ease-out) + 音标 + 发音按钮 + 「不记得」「记得」两个按钮左右分布

**语境填空卡片 (CardCloze)**：
- 隐藏态：例句 15px #333，下划线处用 `______` 占位 + 中文释义提示 14px #888 + 「查看答案」按钮
- 揭示态：完整例句（目标词高亮加粗）+ 单词 + 音标 + 发音按钮 + 「下一个」按钮

**最终确认卡片 (CardConfirm)**：
- 隐藏态：单词 36px + 音标 + 发音按钮 + 点击翻转提示
- 揭示态：单词 + 中文释义 + 「模糊」「记得」按钮

### 8.4 今日总结页 (DaySummary)

全屏居中显示：

```
Day {连续天数}      ← 48px 衬线体 #000

新学  {N} 词        ← 16px #888
复习  {N} 词
累计  {N} 词

明天见              ← 14px #CCC
```

没有其他可交互元素。用户再次打开应用时自动进入新一天。

### 8.5 统计面板 (StatsPanel)

从底部上滑唤出（手势：从屏幕底部向上滑），半屏面板，背景 #FAFAFA，顶部有极细的阴影（`box-shadow: 0 -1px 4px rgba(0,0,0,0.05)`）。

内容：

```
连续打卡      {N} 天
已学单词      {N} / {总数}
已毕业单词    {N}
顽固词        {N}

[词库切换]  ▸
[数据管理]  ▸
[设置]      ▸
```

### 8.6 设置页 (Settings)

全屏视图，从统计面板中的入口进入。

内容：
- 词库选择（单选列表：四级 / 六级 / 考研 / 托福，显示词数）
- 每日最少新词（数字，可通过 +/- 按钮调整，默认 25）
- 自动发音开关
- DeepSeek API Key 输入框（password 类型）
- AI 释义开关
- 导出学习数据按钮
- 导入学习数据按钮
- 重置所有进度按钮（红色 #FF3B30 文字，点击后弹出确认）

### 8.7 首次使用 (Welcome)

首次打开应用时：
1. 全屏显示「默」字（48px 衬线体）+ 下方一行小字 "安静地记单词"（14px #CCC）
2. 停留 1.5 秒后淡出
3. 进入词库选择，默认选中"六级核心"
4. 用户确认后，进入第一天的学习流程

### 8.8 动画规范

- **卡片内容切换**：opacity 300ms ease-out
- **答案揭示**：opacity 250ms ease-out + translateY(8px → 0) 250ms ease-out
- **按钮点击**：opacity → 0.4 → 回弹，150ms
- **底部面板**：transform: translateY(100% → 0)，350ms cubic-bezier(0.25, 1, 0.5, 1)
- **页面切换**：opacity + translateX 左右滑动感，300ms ease-out

**禁止使用**：3D 翻转、弹跳动画、缩放动画、任何花哨过渡效果。一切动画都是安静的、呼吸感的。

### 8.9 手势支持

- **左右滑动**（在卡片区域）：左滑 = 不记得/忘了，右滑 = 记得。与按钮功能等价。
- **点击空白处**：翻转卡片 / 查看答案
- **底部上滑**：唤出统计面板

### 8.10 进度指示点 (ProgressDots)

底部小圆点，指示当前在本轮中的位置：

- 未到达：4px 圆点 #DDD
- 当前：6px 圆点 #000
- 已完成：4px 圆点 #888
- 总数超过 20 时，只显示当前附近 7 个点 + 两端省略号

---

## 任务 9：PWA 配置

### 9.1 vite-plugin-pwa 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'data/*.json'],
      manifest: {
        name: '默',
        short_name: '默',
        description: '安静地记单词',
        start_url: '/',
        display: 'standalone',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.deepseek\.com\//,
            handler: 'NetworkOnly',  // AI API 不缓存
          },
        ],
      },
    }),
  ],
});
```

### 9.2 iOS 适配 meta 标签

在 `index.html` 的 `<head>` 中加入：

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="默">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<link rel="apple-touch-icon" href="/icon-192.png">
```

### 9.3 应用图标

生成两个 PNG 图标（192x192 和 512x512）：
- 白色背景
- 中央一个黑色的「默」字
- 使用衬线体（Noto Serif SC 或思源宋体）
- 字占图标面积约 40%
- 可以用 Canvas API 在构建时动态生成，或者直接手画一个简单的 SVG 转 PNG

---

## 任务 10：数据导入导出

### 10.1 导出

```typescript
async function exportData() {
  const db = await openDB();
  const progress = await db.getAll('progress');
  const dailyLog = await db.getAll('dailyLog');
  const settings = await db.get('settings', 'settings');

  const exportPayload = { progress, dailyLog, settings, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `mo-backup-${getTodayString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 10.2 导入

- 提供文件选择按钮（`<input type="file" accept=".json">`）
- 读取 JSON → 解析 → 弹出确认弹窗：「导入将覆盖当前所有学习进度，是否继续？」
- 确认后写入 IndexedDB 对应 Store，覆盖已有数据
- 导入成功后提示「数据已恢复」

---

## 任务 11：边界情况处理

### 11.1 连续打卡中断
- 用户某天未打开应用 → 次日打开时不显示任何负面提示
- `streakCount` 静默重置为 1
- 到期的复习词正常累积

### 11.2 词库切换
- 切换后新词库从第 0 个开始学习
- 旧词库的进度保留（复习队列仍会出现旧词库的到期词）
- 设置中可选择"清除某词库进度"

### 11.3 词库学完
- 当 `currentWordIndex >= bookWords.length` 时，不再推送新词
- 每日只有复习队列
- 在总结页显示：「本词库已全部学完！」

### 11.4 中断恢复
- 学习过程中退出应用，再次打开时从 `session` Store 恢复
- 如果 `session.date !== today`，丢弃旧会话，重新生成今日队列
- 如果 `session.date === today`，恢复到中断时的阶段和位置

---

## 任务 12：验收清单

完成构建后，逐项检查：

- [ ] **离线可用**：在 iOS Safari 添加到主屏幕后，开启飞行模式，应用完整可用（除 AI 释义）
- [ ] **词库数据完整**：四个词库均有数据，词条包含单词、音标、释义、例句（大部分词有）
- [ ] **首次使用流程**：欢迎页 → 选择词库 → 开始学习
- [ ] **四轮学习流程**：首次相遇 → 主动回忆 → 语境填空 → 最终确认，均正常
- [ ] **复习系统**：次日有复习词出现，间隔和优先级正确
- [ ] **发音功能**：点击按钮可朗读单词，离线可用
- [ ] **AI 释义**：联网且填入 API Key 后，点击「AI 释义」可返回解释
- [ ] **数据持久化**：关闭浏览器重开，进度不丢失
- [ ] **中断恢复**：学习中途关闭再打开，从中断处继续
- [ ] **数据备份**：导出 JSON 可下载，导入可恢复
- [ ] **视觉风格**：黑白极简，大量留白，衬线体单词，无多余装饰
- [ ] **动画流畅**：淡入淡出 + 微位移，无卡顿，无花哨效果
- [ ] **手势操作**：左右滑动可替代按钮操作
- [ ] **连续打卡**：连续使用天数正确累计
- [ ] **PWA**：manifest 和 Service Worker 正确，可添加到 iOS 主屏幕

---

## 附录：关键设计决策说明

1. **为什么用四轮而非单纯翻卡片**：记忆科学表明，被动识别（看英文想中文）的记忆留存率远低于主动检索（看中文想英文）。四轮递进保证每个词经历"被动输入 → 主动检索 → 语境加工 → 再次确认"，形成多维度记忆痕迹。

2. **为什么第三轮不做对错判断**：困难词已经是用户最薄弱的词，反复考试会产生挫败感。第三轮的目的是"再看一遍，在语境中加深理解"，而非再次测试。

3. **为什么不显示打卡中断提示**：任何负面提示（"你中断了 3 天！"）都会增加用户下次打开的心理阻力，导致更长时间的中断。静默重置是最好的策略。

4. **为什么每日新词无上限**：用户说"看我的状态"。有些天可能只想背 25 个，有些天状态好可能想背 60 个。设置下限但不设上限，尊重用户当天的节奏。
