let currentType = 'total';
const fallbackImages = [
  '/images/home-banner.webp',
  '/images/banner2.webp',
  '/images/banner3.webp',
  '/images/banner4.webp',
  '/images/banner5.webp'
];

function safeUrl(value, fallback) {
  const url = String(value || '').trim();
  if (!url) return fallback;
  if (url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
  return fallback;
}

function makeText(className, value, tagName = 'div') {
  const el = document.createElement(tagName);
  el.className = className;
  el.textContent = value;
  return el;
}

async function loadRank(type) {
  currentType = type;
  const res = await fetch(`/api/rank?type=${encodeURIComponent(type)}`);
  const data = await res.json();
  renderStats(data);
  renderList(data);
}

function renderStats(data) {
  const statsRow = document.getElementById('statsRow');
  const totalPoints = data.reduce((sum, member) => sum + member.total_points, 0);
  const topPlayer = data[0];
  const activeMembers = data.filter(member => member.total_points > 0).length;

  statsRow.replaceChildren();
  [
    [totalPoints, '总贡献积分'],
    [activeMembers, '活跃成员'],
    [topPlayer ? topPlayer.nickname : '--', '当前榜首']
  ].forEach(([value, label]) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.appendChild(makeText('value', value));
    card.appendChild(makeText('label', label));
    statsRow.appendChild(card);
  });

  renderChampion(data[0]);
  renderEnergyLane(data);
}

function renderChampion(member) {
  const champion = document.getElementById('champion');
  champion.replaceChildren();
  if (!member) return;

  const orbit = document.createElement('div');
  orbit.className = 'champion-orbit';
  champion.appendChild(orbit);

  const rank = makeText('champion-rank', '01');
  champion.appendChild(rank);

  const img = document.createElement('img');
  img.className = 'champion-avatar';
  img.src = safeUrl(member.avatar, fallbackImages[0]);
  img.alt = member.nickname || '成员';
  img.loading = 'lazy';
  champion.appendChild(img);

  const info = document.createElement('div');
  info.className = 'champion-info';
  info.appendChild(makeText('champion-name', member.nickname || '--'));
  info.appendChild(makeText('champion-meta', `${member.role || '成员'} · ${member.last_reason || '暂无最近贡献'}`));
  info.appendChild(makeText('champion-score', Number(member.total_points || 0).toLocaleString('zh-CN')));
  champion.appendChild(info);
}

function renderEnergyLane(data) {
  const lane = document.getElementById('energyLane');
  lane.replaceChildren();
  const max = Math.max(...data.map(member => member.total_points || 0), 1);

  data.slice(0, 8).forEach((member, index) => {
    const bar = document.createElement('div');
    bar.className = 'energy-bar';
    const height = 18 + ((member.total_points || 0) / max) * 78;
    bar.style.setProperty('--h', `${height}%`);
    const label = document.createElement('span');
    label.textContent = String(index + 1).padStart(2, '0');
    bar.appendChild(label);
    lane.appendChild(bar);
  });
}

function renderList(data) {
  const list = document.getElementById('rankList');
  list.replaceChildren();
  const maxPoints = Math.max(...data.map(member => Number(member.total_points || 0)), 1);

  data.forEach((member, index) => {
    const item = document.createElement('article');
    item.className = 'rank-item';
    item.dataset.rank = String(index + 1);
    item.style.setProperty('--progress', `${Math.max(4, (Number(member.total_points || 0) / maxPoints) * 100)}%`);

    item.appendChild(makeText('rank-num', String(index + 1).padStart(2, '0')));

    const img = document.createElement('img');
    img.className = 'rank-avatar';
    img.src = safeUrl(member.avatar, fallbackImages[index % fallbackImages.length]);
    img.alt = member.nickname || '成员';
    img.loading = 'lazy';
    item.appendChild(img);

    const info = document.createElement('div');
    info.className = 'rank-info';
    const name = makeText('rank-name', member.nickname || '--');
    const role = document.createElement('span');
    role.className = 'rank-role';
    role.textContent = member.role || '';
    name.appendChild(role);
    info.appendChild(name);
    info.appendChild(makeText('rank-reason', member.last_reason ? `最近贡献：${member.last_reason}` : '暂无最近贡献'));
    item.appendChild(info);

    item.appendChild(makeText('rank-points', Number(member.total_points || 0).toLocaleString('zh-CN')));
    list.appendChild(item);
  });
}

document.getElementById('tabBar').addEventListener('click', (event) => {
  const btn = event.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(item => item.classList.remove('active'));
  btn.classList.add('active');
  loadRank(btn.dataset.type);
});

loadRank(currentType);
