/**
 * 词库数据处理脚本 —「默」Mo
 * 
 * 从 KyleBing/english-vocabulary 的 json-sentence 数据
 * 转换为「默」应用的标准 WordEntry 格式。
 * 
 * 用法: node scripts/prepare-vocab.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMP_DIR = join(ROOT, 'temp_vocab');
const OUT_DIR = join(ROOT, 'public', 'data');

// ---- 文件映射 ----
const BOOK_FILES = {
  cet4: ['CET4_1.json', 'CET4_2.json', 'CET4_3.json', 'CET4luan_1.json', 'CET4luan_2.json'],
  cet6: ['CET6_1.json', 'CET6_2.json', 'CET6_3.json', 'CET6luan_1.json'],
  toefl: ['TOEFL_2.json', 'TOEFL_3.json'],
};

// ---- 去重：使用 word 作为去重键，保留第一个 ----
function deduplicateByWord(entries) {
  const seen = new Set();
  return entries.filter(e => {
    const key = e.word.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---- 处理单个词条 ----
function transformEntry(raw, bookId) {
  const word = (raw.word || '').trim();
  if (!word) return null;

  const translations = (raw.translations || [])
    .filter(t => t.translation && t.translation.trim())
    .map(t => ({
      type: (t.type || '').trim(),
      text: t.translation.trim(),
    }));

  // 去除释义为空的词
  if (translations.length === 0) return null;

  // 词组最多 3 个
  const phrases = ((raw.phrases || [])
    .filter(p => p.phrase && p.phrase.trim())
    .slice(0, 3)
    .map(p => ({
      en: p.phrase.trim(),
      zh: (p.translation || '').trim(),
    })));

  // 例句最多 1 个
  let example = null;
  const sentences = raw.sentences || [];
  if (sentences.length > 0 && sentences[0].sentence && sentences[0].sentence.trim()) {
    example = {
      en: sentences[0].sentence.trim(),
      zh: (sentences[0].translation || '').trim(),
    };
  }

  // 缺失音标填空字符串
  const phoneticUs = raw.us ? raw.us.trim() : '';
  const phoneticUk = raw.uk ? raw.uk.trim() : '';

  return {
    id: `${bookId}-${word.toLowerCase().replace(/\s+/g, '-')}`,
    word,
    phoneticUs,
    phoneticUk,
    translations,
    phrases,
    example,
  };
}

// ---- 统计每个词出现在哪些词库中 ----
function buildWordBookMap(allBooks) {
  const wordBookMap = new Map(); // word lowercase -> Set<bookId>

  for (const [bookId, entries] of Object.entries(allBooks)) {
    for (const entry of entries) {
      const key = entry.word.toLowerCase();
      if (!wordBookMap.has(key)) {
        wordBookMap.set(key, new Set());
      }
      wordBookMap.get(key).add(bookId);
    }
  }

  return wordBookMap;
}

// ---- 主流程 ----
function main() {
  if (!existsSync(TEMP_DIR)) {
    console.error('✗ temp_vocab 目录不存在，请先下载原始数据文件');
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  // 第一步：读取并转换所有词库
  const allBooks = {};
  const stats = {};

  for (const [bookId, files] of Object.entries(BOOK_FILES)) {
    console.log(`\n处理 ${bookId}...`);

    let allEntries = [];

    for (const file of files) {
      const filePath = join(TEMP_DIR, file);
      if (!existsSync(filePath)) {
        console.log(`  跳过不存在的文件: ${file}`);
        continue;
      }
      try {
        const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
        const entries = Array.isArray(raw) ? raw : [];
        console.log(`  读取 ${file}: ${entries.length} 条原始词条`);
        allEntries.push(...entries);
      } catch (err) {
        console.error(`  读取 ${file} 失败: ${err.message}`);
      }
    }

    console.log(`  原始总计: ${allEntries.length} 条`);

    // 转换
    const transformed = allEntries
      .map(raw => transformEntry(raw, bookId))
      .filter(Boolean);

    console.log(`  有效词条（释义非空）: ${transformed.length} 条`);

    // 去重
    const unique = deduplicateByWord(transformed);
    console.log(`  去重后: ${unique.length} 条`);

    allBooks[bookId] = unique;
    stats[bookId] = unique.length;
  }

  // 第二步：统计每个词出现在哪些词库中
  console.log('\n统计跨词库重复词...');
  const wordBookMap = buildWordBookMap(allBooks);

  // 第三步：写入 appearsInBooks 并输出
  for (const [bookId, entries] of Object.entries(allBooks)) {
    const entriesWithBooks = entries.map(entry => {
      const appearsInBooks = Array.from(wordBookMap.get(entry.word.toLowerCase()) || []);
      return {
        ...entry,
        appearsInBooks,
      };
    });

    const outPath = join(OUT_DIR, `${bookId}.json`);
    writeFileSync(outPath, JSON.stringify(entriesWithBooks), 'utf-8');
    console.log(`  → 写入 ${outPath} (${entriesWithBooks.length} 词)`);
  }

  // 统计核心词（出现在 3 个及以上词库中）
  let coreWords = 0;
  for (const [word, books] of wordBookMap.entries()) {
    if (books.size >= 3) coreWords++;
  }

  console.log('\n===== 数据处理完成 =====');
  for (const [bookId, count] of Object.entries(stats)) {
    console.log(`  ${bookId}: ${count} 词`);
  }
  console.log(`  核心词（≥3 词库）: ${coreWords} 个`);
  console.log('========================\n');
}

main();
