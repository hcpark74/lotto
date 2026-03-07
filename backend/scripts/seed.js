// 전체 로또 당첨 이력을 수집해 seed.sql 파일로 저장하는 스크립트
// 실행: node scripts/seed.js
// 적재: wrangler d1 execute lotto_db --remote --file=./seed.sql

const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.dhlottery.co.kr/lt645/result',
  'Accept': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

async function getLatestDrawNo() {
  const response = await fetch('https://www.dhlottery.co.kr/lt645/result', { headers: HEADERS });
  const html = await response.text();
  const match = html.match(/id="opt_val"\s+value="(\d+)"/);
  if (!match) throw new Error('최신 회차 번호를 찾을 수 없습니다.');
  return parseInt(match[1]);
}

async function fetchBatch(dir, ltEpsd, cursorLtEpsd) {
  const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=${dir}&srchLtEpsd=${ltEpsd}&srchCursorLtEpsd=${cursorLtEpsd}`;
  const response = await fetch(url, { headers: HEADERS });
  const data = await response.json();
  return data?.data?.list ?? [];
}

async function main() {
  const allDraws = [];

  const latestDrawNo = await getLatestDrawNo();
  console.log(`최신 회차: ${latestDrawNo}회`);
  console.log('데이터 수집 시작...');

  let cursor = latestDrawNo;
  let page = 1;

  while (cursor >= 1) {
    const batch = await fetchBatch('center', cursor, cursor);
    if (!batch.length) break;

    for (const item of batch) {
      allDraws.push(item);
    }

    const minEpsd = Math.min(...batch.map(r => r.ltEpsd));
    process.stdout.write(`\r페이지 ${page} 완료 (회차: ${minEpsd}~${cursor}, 총 ${allDraws.length}건)`);

    if (minEpsd <= 1) break;

    cursor = minEpsd - 1;
    page++;

    // 요청 간 딜레이 (rate limit 방지)
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n\nSQL 생성 중...');

  // 중복 회차 제거
  const seen = new Set();
  const unique = allDraws.filter(item => {
    if (seen.has(item.ltEpsd)) return false;
    seen.add(item.ltEpsd);
    return true;
  });
  unique.sort((a, b) => a.ltEpsd - b.ltEpsd);

  console.log(`\n중복 제거: ${allDraws.length}건 → ${unique.length}건`);

  const lines = ['DELETE FROM lotto_history;', ''];
  const allDraws2 = unique;

  for (const item of allDraws2) {
    const d = String(item.ltRflYmd);
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    lines.push(
      `INSERT INTO lotto_history (drwNo, drwNoDate, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo, firstWinamnt) VALUES (${item.ltEpsd}, '${date}', ${item.tm1WnNo}, ${item.tm2WnNo}, ${item.tm3WnNo}, ${item.tm4WnNo}, ${item.tm5WnNo}, ${item.tm6WnNo}, ${item.bnsWnNo}, ${item.rnk1WnAmt});`
    );
  }

  fs.writeFileSync('./seed.sql', lines.join('\n'));
  console.log(`완료: seed.sql 생성 (총 ${unique.length}회차)`);
  console.log('\n다음 명령어로 D1에 적재하세요:');
  console.log('wrangler d1 execute lotto_db --remote --file=./seed.sql');
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
