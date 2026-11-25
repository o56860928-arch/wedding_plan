// Notion API 공통 도우미. 토큰은 Vercel 환경변수(NOTION_TOKEN)에만 있고, 브라우저로는 나가지 않아요.
const V = '2022-06-28';
const clean = s => String(s || '').replace(/-/g, '').toLowerCase();

// 노션 페이지에 들어 있는 데이터베이스 ID (주소 끝의 32자리). 필요하면 여기만 고치면 돼요.
const DB = {
  info: '423dae6dbf8481bea104d9505782ba5d',
  budgetSum: '423dae6dbf8481a39742cbf712e57ffd',
  decisions: '423dae6dbf848173b7fcfd509fa56fdd',
  todo: '423dae6dbf8481ca8e3dde07596a8f9a',
  events: '423dae6dbf84816b9caafcaf0c7dd351',
  budget: '423dae6dbf8481d38215ee94ac904259',
  shops: '423dae6dbf8481ada61ad5928a7455ca',
  guests: '423dae6dbf848144a1a9caf71545f8e8'
};

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

module.exports = { DB, clean, call, queryAll, props };
