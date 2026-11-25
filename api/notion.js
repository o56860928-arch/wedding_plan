// GET /api/notion  → 노션 "준비" 페이지의 데이터를 한 번에 읽어서 사이트가 쓰기 좋은 모양으로 돌려줘요.
const { findDBs, queryAll, props } = require('./_notion');

const man = n => (n == null ? 0 : Math.round((n / 10000) * 10) / 10); // 원 → 만원

module.exports = async (req, res) => {
  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN 환경변수가 없어요' });
  try {
    const DB = await findDBs(token);
    const keys = Object.keys(DB);
    const lists = await Promise.all(keys.map(k => queryAll(DB[k], token)));
    const raw = Object.fromEntries(keys.map((k, i) => [k, lists[i].map(p => ({ id: p.id, ...props(p) }))]));

    const info = raw.info[0] || {};
    const sum = raw.budgetSum[0] || {};
    const d10 = s => (s ? String(s).slice(0, 10) : '');
    const wed = d10(info['예식일']);

    const events = raw.events.map(r => ({
      id: r.id, t: r['일정'], d: d10(r['날짜']),
      time: r['날짜'] && String(r['날짜']).length > 10 ? String(r['날짜']).slice(11, 16) : '',
      k: (r['종류'] === '계약' || r['종류'] === '결제') ? 'pay' : 'etc'
    })).filter(r => r.d);
    if (wed) events.push({ id: 'wedding', t: '💍 결혼식', d: wed, time: '', k: 'wed' });

    const shops = raw.shops.map(r => ({
      id: r.id, name: r['업체명'], cat: r['분류'], price: man(r['가격']), incl: r['포함 내역'], extra: r['추가금'],
      pros: r['좋은 점'], cons: r['아쉬운 점'], stars: r['별점'], final: !!r['최종 선택'], contact: r['연락처'], prog: r['진행']
    }));

    const out = {
      at: new Date().toISOString(),
      info: { wed, venue: info['예식장'] || '', bride: info['신부'] || '', groom: info['신랑'] || '', meal: man(info['1인 식대']) },
      goal: man(sum['가용 예산']),
      decisions: shops.filter(s => s.final || s.prog === '계약 완료').map(s => ({
        id: s.id, item: s.cat, status: s.prog === '계약 완료' ? '확정' : '진행 중', vendor: s.name, amount: s.price, date: '', memo: s.incl || ''
      })),
      todo: raw.todo.map(r => ({ id: r.id, m: r['추천시기'], c: r['구분'], t: r['할 일'], s: r['완료'] ? '완료' : '할 일', due: d10(r['목표일']), ord: r['일 전'] }))
        .filter(r => r.t).sort((a, b) => (b.ord || 0) - (a.ord || 0)),
      events,
      budget: raw.budget.map(r => ({
        id: r.id, item: r['항목'], cat: r['분류'], amount: man(r['금액']), deposit: man(r['계약금']),
        status: r['잔금 상태'] === '완납' ? '완료' : '예정', bal: r['잔금 상태'], date: '', memo: r['메모'], vendor: r['업체']
      })),
      shops,
      guests: raw.guests.map(r => ({
        id: r.id, name: r['이름'], rel: r['그룹'], side: r['측'], att: r['참석'], n: 1,
        inv: r['모바일 청첩장'] ? '보냄' : '', gift: man(r['축의금']), memo: r['메모']
      }))
    };
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.status(200).json(out);
  } catch (e) {
    res.status(e.status === 401 || e.status === 404 ? e.status : 502).json({ error: String(e.message || e) });
  }
};
