// Notion API 공통 도우미. 토큰은 Vercel 환경변수(NOTION_TOKEN)에만 있고, 브라우저로는 나가지 않아요.
const V = '2022-06-28';
const clean = s => String(s || '').replace(/-/g, '').toLowerCase();

// 사용 중인 데이터베이스 이름 (노션 "준비" 페이지 안의 DB 제목). 이름으로 자동으로 찾아요.
const NAMES = { info: '우리 결혼 정보', budgetSum: '예산 요약', todo: '로드맵', events: '일정', budget: '예산표', shops: '업체 리스트', guests: '하객 명단' };
async function call(path, token, opt = {}) {
  const r = await fetch('https://api.notion.com/v1' + path, {
    ...opt,
    headers: { Authorization: 'Bearer ' + token, 'Notion-Version': V, 'Content-Type': 'application/json' }
  });
  if (!r.ok) {
    const t = await r.text();
    const e = new Error('Notion ' + r.status + ' ' + t.slice(0, 200));
    e.status = r.status;
    throw e;
  }
  return r.json();
}

async function queryAll(id, token) {
  const out = [];
  let cursor;
  do {
    const j = await call('/databases/' + id + '/query', token, {
      method: 'POST',
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
    });
    out.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return out;
}

// 속성 하나를 평범한 값(문자열·숫자·불리언·날짜)으로 바꿔요.
function val(p) {
  if (!p) return null;
  switch (p.type) {
    case 'title': return p.title.map(x => x.plain_text).join('');
    case 'rich_text': return p.rich_text.map(x => x.plain_text).join('');
    case 'select': return p.select ? p.select.name : null;
    case 'status': return p.status ? p.status.name : null;
    case 'number': return p.number;
    case 'checkbox': return p.checkbox;
    case 'date': return p.date ? p.date.start : null;
    case 'formula': return p.formula[p.formula.type];
    case 'rollup': return p.rollup.type === 'number' ? p.rollup.number : null;
    case 'files': return p.files.length ? (p.files[0].file || p.files[0].external || {}).url || null : null;
    default: return null;
  }
}
const props = page => Object.fromEntries(Object.entries(page.properties).map(([k, v]) => [k, val(v)]));

// 통합에 연결된 데이터베이스를 검색해서 이름 → ID 표로 만들어요 (인스턴스 안에서 재사용).
let cache = null;
async function findDBs(token) {
  if (cache && Date.now() - cache.t < 5 * 60 * 1000) return cache.m;
  const found = {};
  let cursor;
  do {
    const j = await call('/search', token, { method: 'POST', body: JSON.stringify({ filter: { property: 'object', value: 'database' }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }) });
    for (const d of j.results) {
      const name = (d.title || []).map(x => x.plain_text).join('').replace(/[^\p{L}\p{N} ·]/gu, '').trim();
      if (name && !found[name]) found[name] = d.id;
    }
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  const m = {};
  for (const [k, n] of Object.entries(NAMES)) m[k] = found[n];
  const missing = Object.entries(m).filter(([, v]) => !v).map(([k]) => NAMES[k]);
  if (missing.length) { const e = new Error('노션에서 이 데이터베이스를 못 찾았어요: ' + missing.join(', ') + ' (준비 페이지의 ··· → 연결에 통합이 추가돼 있는지 확인해 주세요)'); e.status = 404; throw e; }
  cache = { t: Date.now(), m };
  return m;
}

module.exports = { NAMES, findDBs, clean, call, queryAll, props };
