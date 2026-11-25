// GET /api/notion  → 노션의 결혼 준비 데이터를 한 번에 읽어서 사이트가 쓰기 좋은 모양으로 돌려줘요.
const { DB, queryAll, props } = require('./_notion');

module.exports = async (req, res) => {
  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN 환경변수가 없어요' });
  try {
    const keys = Object.keys(DB);
    const lists = await Promise.all(keys.map(k => queryAll(DB[k], token)));
    const raw = Object.fromEntries(keys.map((k, i) => [k, lists[i].map(p => ({ id: p.id, ...props(p) }))]));

    const info = raw.info[0] || {};
    const sum = raw.budgetSum[0] || {};
    const d10 = s => (s ? String(s).slice(0, 10) : '');

    const out = {
      at: new Date().toISOString(),
      info: { wed: d10(info['예식일']), venue: info['예식장'] || '', bride: info['신부'] || '', groom: info['신랑'] || '', meal: info['1인 식대'] || 0 },
      goal: sum['가용 예산'] || 0,
      decisions: raw.decisions.map(r => ({ id: r.id, item: r['항목'], status: r['상태'], vendor: r['업체·장소'], amount: r['금액(만원)'], date: d10(r['날짜']), memo: r['메모'] })),
      todo: raw.todo.map(r => ({ id: r.id, m: r['시기'], c: r['분류'], t: r['할 일'], s: r['상태'], due: d10(r['마감일']) })).filter(r => r.t),
      events: raw.events.map(r => ({ id: r.id, t: r['일정'], d: d10(r['날짜']), time: r['날짜'] && String(r['날짜']).length > 10 ? String(r['날짜']).slice(11, 16) : '', k: r['종류'] === '결혼식' ? 'wed' : (r['종류'] === '계약금' || r['종류'] === '잔금') ? 'pay' : 'etc', vendor: r['업체'] })).filter(r => r.d),
      budget: raw.budget.map(r => ({ id: r.id, item: r['항목'], cat: r['분류'], amount: r['금액(만원)'] || 0, deposit: r['계약금(만원)'] || 0, status: r['상태'], bal: r['잔금 상태'], date: d10(r['날짜']), memo: r['메모'] })),
      shops: raw.shops.map(r => ({ id: r.id, name: r['업체'], cat: r['분류'], price: r['가격(만원)'], incl: r['포함 내역'], extra: r['추가금'], pros: r['장점'], cons: r['단점'], stars: r['별점'], final: !!r['최종 선택'], contact: r['연락처'] })),
      guests: raw.guests.map(r => ({ id: r.id, name: r['이름'], rel: r['관계'], side: r['측'], att: r['참석'], n: r['인원'], inv: r['청첩장'], gift: r['축의금(만원)'], memo: r['메모'] }))
    };
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.status(200).json(out);
  } catch (e) {
    res.status(e.status === 401 || e.status === 404 ? e.status : 502).json({ error: String(e.message || e) });
  }
};
