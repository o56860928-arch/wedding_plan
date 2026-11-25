// POST /api/toggle  {id, done} → 체크리스트 한 줄의 상태를 체크/해제해요.
// 체크리스트 데이터베이스에 속한 페이지의 '완료' 체크만 바꿀 수 있고, 다른 건 건드리지 않아요.
const { findDBs, clean, call } = require('./_notion');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능해요' });
  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN 환경변수가 없어요' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const id = clean(body.id);
    if (!/^[0-9a-f]{32}$/.test(id)) return res.status(400).json({ error: '잘못된 id' });
    const DB = await findDBs(token);
    const page = await call('/pages/' + id, token);
    if (clean(page.parent && page.parent.database_id) !== clean(DB.todo)) return res.status(403).json({ error: '체크리스트 항목이 아니에요' });
    await call('/pages/' + id, token, {
      method: 'PATCH',
      body: JSON.stringify({ properties: { '완료': { checkbox: !!body.done } } })
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
