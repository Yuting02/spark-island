// 前端 API 封装：玩家侧 + 管理侧
async function request(method, url, body, token) {
  const headers = {};
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
  return data;
}

export const api = {
  createPlayer: (nickname) => request('POST', '/api/players', { nickname }),
  newsToday: () => request('GET', '/api/news/today'),
  books: () => request('GET', '/api/books'),
  radio: () => request('GET', '/api/radio'),
  notes: (playerId) => request('GET', `/api/notes/${playerId}`),
  saveNote: (payload) => request('POST', '/api/notes', payload),
  progress: (playerId) => request('GET', `/api/progress/${playerId}`),
  completeTask: (playerId, task) => request('POST', '/api/progress', { playerId, task }),
};

export const adminApi = {
  login: (password) => request('POST', '/api/admin/login', { password }),
  overview: (t) => request('GET', '/api/admin/overview', null, t),
  listNews: (t) => request('GET', '/api/admin/news', null, t),
  addNews: (t, payload) => request('POST', '/api/admin/news', payload, t),
  delNews: (t, id) => request('DELETE', `/api/admin/news/${id}`, null, t),
  listBooks: () => request('GET', '/api/books'),
  addBook: (t, formData) => request('POST', '/api/admin/books', formData, t),
  delBook: (t, id) => request('DELETE', `/api/admin/books/${id}`, null, t),
  listRadio: () => request('GET', '/api/radio'),
  addRadio: (t, formData) => request('POST', '/api/admin/radio', formData, t),
  delRadio: (t, id) => request('DELETE', `/api/admin/radio/${id}`, null, t),
};
