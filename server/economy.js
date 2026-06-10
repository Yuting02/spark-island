// 金币经济：奖励常量、咖啡馆菜单、钱包操作（所有发放/扣减都走服务端记账）
import { all, insert, update, newId } from './db.js';

export const REWARD = {
  welcome: 10, // 首次进入游戏
  task: 10, // 每完成一项每日任务
  reading: 10, // 当日阅读累计达 30 分钟
  email: 100, // 绑定邮箱
};

export const READING_GOAL_SECONDS = 30 * 60;

export const CAFE_MENU = [
  { id: 'americano', name: '美式咖啡', price: 9, emoji: '☕' },
  { id: 'latte', name: '拿铁', price: 15, emoji: '🥛' },
  { id: 'cappuccino', name: '卡布奇诺', price: 18, emoji: '🍮' },
  { id: 'mocha', name: '摩卡', price: 22, emoji: '🍫' },
  { id: 'milktea', name: '珍珠奶茶', price: 28, emoji: '🧋' },
  { id: 'special', name: '店长特调', price: 35, emoji: '✨' },
];

export function getPlayer(playerId) {
  return all('players').find((p) => p.id === playerId) ?? null;
}

/** 加/扣金币并记一笔交易；余额不足返回 null */
export function addCoins(playerId, amount, reason) {
  const player = getPlayer(playerId);
  if (!player) return null;
  const balance = (player.coins ?? 0) + amount;
  if (balance < 0) return null;
  update('players', (p) => p.id === playerId, (p) => (p.coins = balance));
  insert('transactions', {
    id: newId(),
    playerId,
    amount,
    reason,
    balance,
    createdAt: new Date().toISOString(),
  });
  return balance;
}
