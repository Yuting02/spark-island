// JSON 文件存储层：单文件 db.json，写入走「临时文件 + rename」保证原子性。
// 接口刻意收敛成 all/insert/remove/update，后续平替 SQLite 时只改这一个文件。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { news: [], books: [], radio: [], players: [], notes: [], progress: [], transactions: [], reading: [], orders: [] };

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch {
    cache = structuredClone(EMPTY);
  }
  return cache;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export const newId = () => crypto.randomUUID();

/** 当前服务器时区的 YYYY-MM-DD */
export function today() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

export function all(collection) {
  return load()[collection];
}

export function insert(collection, doc) {
  load()[collection].push(doc);
  save();
  return doc;
}

export function remove(collection, predicate) {
  const db = load();
  const kept = db[collection].filter((d) => !predicate(d));
  const removed = db[collection].length - kept.length;
  db[collection] = kept;
  if (removed) save();
  return removed;
}

export function update(collection, predicate, mutate) {
  const db = load();
  const doc = db[collection].find(predicate);
  if (doc) {
    mutate(doc);
    save();
  }
  return doc;
}
