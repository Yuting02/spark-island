// 种子数据：示例新闻（markdown）+ 程序生成的示例 epub（jszip）+ 程序生成的示例音频（WAV 正弦旋律）。
// 已有数据时跳过，可用 --force 清空重建（仅清内容集合，不动玩家/笔记）。
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { all, insert, remove, newId, today, UPLOAD_DIR } from '../server/db.js';

const force = process.argv.includes('--force');

if (force) {
  for (const c of ['news', 'books', 'radio']) remove(c, () => true);
}
if (all('news').length || all('books').length || all('radio').length) {
  console.log('已有内容数据，跳过种子（使用 npm run seed -- --force 可重建）');
  process.exit(0);
}

// ── 1. 示例新闻 ──
const newsContent = `> 本条为**示例内容**，请管理员在后台替换为真实的每日 AI 新闻。

## 🤖 模型动态

**示例条目一**：某大模型厂商发布新一代旗舰模型，上下文窗口与推理能力较上代显著提升，定价保持不变。社区初步实测显示其在代码与长文档任务上表现亮眼。

**示例条目二**：开源社区推出轻量级多模态模型，可在消费级显卡上运行，适合本地部署与隐私敏感场景。

## 🛠️ 工具与产品

**示例条目三**：一款 AI 编程助手新增"项目级重构"能力，可以跨文件理解依赖并给出迁移方案。

## 📄 论文速读

**示例条目四**：新论文提出一种更省显存的注意力机制，在长序列任务上以更低成本逼近全量注意力的效果。

---

*在管理后台（/admin）以 Markdown 格式上传每日新闻，玩家在报亭看到的就是这份"报纸"。*`;

insert('news', {
  id: newId(),
  title: 'AI 日报 · 创刊号（示例）',
  date: today(),
  content: newsContent,
  createdAt: new Date().toISOString(),
});
console.log('✓ 示例新闻');

// ── 2. 示例 epub：《道德经》节选（公版内容） ──
const chapters = [
  ['第一章', '道可道，非常道；名可名，非常名。无名天地之始，有名万物之母。故常无欲，以观其妙；常有欲，以观其徼。此两者同出而异名，同谓之玄，玄之又玄，众妙之门。'],
  ['第八章', '上善若水。水善利万物而不争，处众人之所恶，故几于道。居善地，心善渊，与善仁，言善信，政善治，事善能，动善时。夫唯不争，故无尤。'],
  ['第三十三章', '知人者智，自知者明。胜人者有力，自胜者强。知足者富，强行者有志。不失其所者久，死而不亡者寿。'],
  ['第六十四章', '合抱之木，生于毫末；九层之台，起于累土；千里之行，始于足下。民之从事，常于几成而败之。慎终如始，则无败事。'],
];

const xhtml = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh">
<head><title>${title}</title></head>
<body><h2>${title}</h2>${body}</body>
</html>`;

const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
zip.file(
  'META-INF/container.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
);

const manifest = chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ');
const spine = chapters.map((_, i) => `<itemref idref="c${i}"/>`).join('');
zip.file(
  'OEBPS/content.opf',
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:${newId()}</dc:identifier>
    <dc:title>道德经（节选）</dc:title>
    <dc:creator>老子</dc:creator>
    <dc:language>zh</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifest}
  </manifest>
  <spine>${spine}</spine>
</package>`
);
zip.file(
  'OEBPS/nav.xhtml',
  xhtml(
    '目录',
    `<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc"><ol>${chapters
      .map(([t], i) => `<li><a href="c${i}.xhtml">${t}</a></li>`)
      .join('')}</ol></nav>`
  )
);
chapters.forEach(([title, text], i) => {
  zip.file(`OEBPS/c${i}.xhtml`, xhtml(title, `<p>${text}</p>`));
});

const booksDir = path.join(UPLOAD_DIR, 'books');
fs.mkdirSync(booksDir, { recursive: true });
const epubName = `seed-daodejing.epub`;
fs.writeFileSync(path.join(booksDir, epubName), await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' }));
insert('books', {
  id: newId(),
  title: '道德经（节选）',
  author: '老子',
  file: `/uploads/books/${epubName}`,
  createdAt: new Date().toISOString(),
});
console.log('✓ 示例 epub');

// ── 3. 示例音频：五声音阶小旋律 WAV（16-bit PCM mono） ──
const RATE = 22050;
const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]; // C D E G A C'
const seq = [0, 2, 4, 3, 5, 4, 2, 0, 1, 3, 2, 4, 5, 3, 2, 0];
const NOTE = 0.45; // 每个音 0.45s，循环 5 遍 ≈ 36s
const LOOPS = 5;
const total = Math.floor(RATE * NOTE * seq.length * LOOPS);
const pcm = Buffer.alloc(total * 2);
for (let i = 0; i < total; i++) {
  const t = i / RATE;
  const idx = Math.floor(t / NOTE) % seq.length;
  const freq = scale[seq[idx]];
  const tin = (t % NOTE) / NOTE;
  const env = Math.min(1, tin * 12) * Math.exp(-tin * 3); // 起音 + 衰减包络
  const sample = (Math.sin(2 * Math.PI * freq * t) * 0.6 + Math.sin(4 * Math.PI * freq * t) * 0.15) * env * 0.5;
  pcm.writeInt16LE(Math.round(sample * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const radioDir = path.join(UPLOAD_DIR, 'radio');
fs.mkdirSync(radioDir, { recursive: true });
const wavName = 'seed-town-melody.wav';
fs.writeFileSync(path.join(radioDir, wavName), Buffer.concat([header, pcm]));
insert('radio', {
  id: newId(),
  title: '电台试播 · 星火旋律（示例）',
  file: `/uploads/radio/${wavName}`,
  createdAt: new Date().toISOString(),
});
console.log('✓ 示例音频');
console.log('种子完成 🌱');
