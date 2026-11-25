// POST /api/budget
//  {action:'goal', value:3000}                         → 가용 예산(만원) 저장
//  {action:'add', item, cat, amount, deposit}          → 예산표에 항목 추가 (만원 단위)
const { findDBs, call } = require('./_notion');
const won = n => Math.round(Number(n) * 10000);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능해요' });
  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN 환경변수가 없어요' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const DB = await findDBs(token);
    if (b.action === 'goal') {
      const v = Number(b.value);
      if (!isFinite(v) || v < 0) return res.status(400).json({ error: '금액을 확인해 주세요' });
      const q = await call('/databases/' + DB.budgetSum + '/query', token, { method: 'POST', body: JSON.stringify({ page_size: 1 }) });
      if (q.results.length) {
        await call('/pages/' + q.results[0].id, token, { method: 'PATCH', body: JSON.stringify({ properties: { '가용 예산': { number: won(v) } } }) });
      } else {
        await call('/pages', token, { method: 'POST', body: JSON.stringify({ parent: { database_id: DB.budgetSum }, properties: { '이름': { title: [{ text: { content: '우리 예산' } }] }, '가용 예산': { number: won(v) } } }) });
      }
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'add') {
      const item = String(b.item || '').trim().slice(0, 100);
      if (!item) return res.status(400).json({ error: '항목 이름을 적어 주세요' });
      const properties = { '항목': { title: [{ text: { content: item } }] }, '금액': { number: won(b.amount || 0) }, '계약금': { number: won(b.deposit || 0) } };
      if (b.cat) properties['분류'] = { select: { name: String(b.cat).slice(0, 50) } };
      const q = await call('/databases/' + DB.budgetSum + '/query', token, { method: 'POST', body: JSON.stringify({ page_size: 1 }) });
      if (q.results.length) properties['예산 요약'] = { relation: [{ id: q.results[0].id }] };
      await call('/pages', token, { method: 'POST', body: JSON.stringify({ parent: { database_id: DB.budget }, properties }) });
      return res.status(200).json({ ok: true });
    }
    res.status(400).json({ error: '알 수 없는 요청' });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
