# 榛?(Mo) 鈥?鑻辫鑳屽崟璇?PWA

> 瀹夐潤鍦拌鍗曡瘝銆侫pple 寮忔瀬绠€榛戠櫧椋庢牸锛屽洓杞€掕繘瀛︿範娴佺▼锛屽熀浜庨棿闅旈噸澶嶃€?
## 鎶€鏈爤

| 灞傞潰 | 閫夊瀷 |
|------|------|
| 妗嗘灦 | React 18 + TypeScript |
| 鏋勫缓 | Vite 6 |
| PWA | vite-plugin-pwa (Workbox) |
| 瀛樺偍 | IndexedDB (idb) |
| 鍙戦煶 | Web Speech API |
| AI 閲婁箟 | DeepSeek API |
| 鏍峰紡 | 鍘熺敓 CSS + CSS Variables |

## 蹇€熷紑濮?
```bash
# 瀹夎渚濊禆
npm install

# 鏈湴寮€鍙?npm run dev

# 鏋勫缓鐢熶骇鐗堟湰
npm run build

# 棰勮鏋勫缓缁撴灉
npm run preview
```

## 椤圭洰缁撴瀯

```
mo/
鈹溾攢鈹€ public/
鈹?  鈹溾攢鈹€ icon-192.png / icon-512.png   鈫?搴旂敤鍥炬爣
鈹?  鈹斺攢鈹€ data/
鈹?      鈹溾攢鈹€ cet4.json    (4,544 璇?
鈹?      鈹溾攢鈹€ cet6.json    (3,992 璇?
鈹?      鈹斺攢鈹€ toefl.json   (10,367 璇?
鈹溾攢鈹€ scripts/
鈹?  鈹溾攢鈹€ prepare-vocab.mjs     鈫?璇嶅簱鏁版嵁澶勭悊鑴氭湰
鈹?  鈹溾攢鈹€ generate-icons.mjs    鈫?PNG 鍥炬爣鐢熸垚鑴氭湰
鈹?  鈹斺攢鈹€ generate-icons.html   鈫?娴忚鍣ㄥ浘鏍囩敓鎴愬櫒
鈹溾攢鈹€ src/
鈹?  鈹溾攢鈹€ App.tsx               鈫?鏍圭粍浠?/ 瑙嗗浘璺敱
鈹?  鈹溾攢鈹€ main.tsx
鈹?  鈹溾攢鈹€ types/index.ts        鈫?鍏ㄥ眬绫诲瀷
鈹?  鈹溾攢鈹€ styles/global.css     鈫?鍏ㄥ眬鏍峰紡
鈹?  鈹溾攢鈹€ lib/
鈹?  鈹?  鈹溾攢鈹€ db.ts             鈫?IndexedDB 灏佽
鈹?  鈹?  鈹溾攢鈹€ scheduler.ts      鈫?闂撮殧閲嶅绠楁硶
鈹?  鈹?  鈹斺攢鈹€ ai.ts             鈫?DeepSeek API
鈹?  鈹溾攢鈹€ hooks/
鈹?  鈹?  鈹溾攢鈹€ useStudySession.ts 鈫?瀛︿範鐘舵€佹満
鈹?  鈹?  鈹溾攢鈹€ useWordbook.ts    鈫?璇嶅簱绠＄悊
鈹?  鈹?  鈹斺攢鈹€ useSpeech.ts      鈫?鍙戦煶
鈹?  鈹斺攢鈹€ components/
鈹?      鈹溾攢鈹€ Welcome.tsx        鈫?棣栨娆㈣繋椤?鈹?      鈹溾攢鈹€ CardDisplay.tsx    鈫?ROUND_1 棣栨鐩搁亣
鈹?      鈹溾攢鈹€ DaySummary.tsx     鈫?姣忔棩鎬荤粨
鈹?      鈹溾攢鈹€ Settings.tsx       鈫?璁剧疆椤?鈹?      鈹溾攢鈹€ SpeakButton.tsx    鈫?鍙戦煶鎸夐挳
鈹?      鈹溾攢鈹€ ProgressDots.tsx   鈫?杩涘害鐐?鈹?      鈹斺攢鈹€ AiExplain.tsx     鈫?AI 閲婁箟
鈹溾攢鈹€ vite.config.ts
鈹溾攢鈹€ tsconfig.json
鈹斺攢鈹€ package.json
```

## 瀛︿範娴佺▼

```
REVIEW 鈫?ROUND_1 (棣栨鐩搁亣) 鈫?ROUND_2 (涓诲姩鍥炲繂) 鈫?ROUND_3 (璇濉┖) 鈫?ROUND_4 (鏈€缁堢‘璁? 鈫?SUMMARY
```

- **REVIEW**: 澶嶄範鍒版湡鏃ц瘝锛堜腑鏂団啋鑻辨枃 / 渚嬪彞濉┖锛?- **ROUND_1**: 娴忚鏂拌瘝锛屽缓绔嬬涓€鍗拌薄
- **ROUND_2**: 鐪嬩腑鏂囧洖蹇嗚嫳鏂囷紝鏍囪鍥伴毦璇?- **ROUND_3**: 浠呭鍥伴毦璇嶄緥鍙ュ～绌猴紝涓嶅仛瀵归敊鍒ゆ柇
- **ROUND_4**: 鏈€缁堢‘璁や粖鏃ユ墍鏈夋柊璇?
## 闂撮殧閲嶅

| 闃舵 | 闂撮殧 |
|------|------|
| 0 | 褰撳ぉ |
| 1 | 1 澶╁悗 |
| 2 | 3 澶╁悗 |
| 3 | 7 澶╁悗 |
| 4 | 14 澶╁悗 |
| 5 | 姣曚笟 |

- 绛斿 鈫?闃舵 +1
- 绛旈敊 鈫?鍥為€€鍒伴樁娈?1
- 杩炵画 2 娆＄瓟閿?鈫?鏍囪涓洪〗鍥鸿瘝锛堜紭鍏堝涔狅級

## 璇嶅簱鏁版嵁澶勭悊

```bash
# 1. 浠?jsDelivr CDN 涓嬭浇鍘熷鏁版嵁鍒?temp_vocab/
#    鏁版嵁婧? KyleBing/english-vocabulary (json-sentence 鐗堟湰)

# 2. 杩愯澶勭悊鑴氭湰
node scripts/prepare-vocab.mjs

```

## 閮ㄧ讲鍒?Vercel

1. 灏嗛」鐩帹閫佸埌 GitHub
2. 鍦?Vercel 涓鍏ラ」鐩?3. 妗嗘灦棰勮閫夋嫨 **Vite**
4. 鏋勫缓鍛戒护: `npm run build`
5. 杈撳嚭鐩綍: `dist`
6. 閮ㄧ讲瀹屾垚鍚庤闂垎閰嶅煙鍚?
## iPhone 娣诲姞鍒颁富灞忓箷

1. Safari 涓墦寮€閮ㄧ讲鍚庣殑 URL
2. 鐐瑰嚮搴曢儴銆屽垎浜€嶆寜閽紙鈫戯級
3. 閫夋嫨銆屾坊鍔犲埌涓诲睆骞曘€?4. 纭鍚嶇О銆岄粯銆嶏紝鐐瑰嚮銆屾坊鍔犮€?5. 涓诲睆骞曞嚭鐜般€岄粯銆嶅浘鏍囷紝鐐瑰嚮鍗冲彲浣滀负鐙珛 App 浣跨敤

## 宸茬煡闄愬埗

1. **鍥炬爣涓虹櫧鑹插崰浣嶅浘**锛氶渶鍦ㄦ祻瑙堝櫒涓墦寮€ `scripts/generate-icons.html` 鐢熸垚甯︺€岄粯銆嶅瓧鐨勬寮忓浘鏍囷紝鏇挎崲 `public/icon-192.png` 鍜?`public/icon-512.png`
2. **AI 閲婁箟闇€瑕佽仈缃?*锛氶渶瑕佺敤鎴疯嚜琛屽～鍐?DeepSeek API Key
3. **Web Speech API**锛氶儴鍒嗘祻瑙堝櫒/绯荤粺鍙兘涓嶆敮鎸佺绾胯闊筹紙iOS Safari 鏀寔鐨勮闊宠緝灏戯級
4. **璇嶅簱瀵煎叆瀵煎嚭**锛氬鍏ヤ細瀹屽叏瑕嗙洊褰撳墠杩涘害
5. **瑙︽帶鎵嬪娍**锛氬乏鍙虫粦鍔ㄥ湪閮ㄥ垎 Android 娴忚鍣ㄤ笂鍙兘鍐茬獊

## 云同步后端

本项目采用离线优先：IndexedDB 是主存储，Supabase 只保存 settings / progress / dailyLog 的同步镜像。

Vercel 环境变量：

```bash
SUPABASE_URL=https://vulhknwigcokyubftpwx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
MO_SYNC_TOKEN=你自己生成的长随机同步令牌
```

部署到 Vercel 后，在设置页开启「云同步」，输入同一个 `MO_SYNC_TOKEN`，点击「立即同步」即可。
