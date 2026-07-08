let currentType = 'total';

async function loadRank(type) {
  currentType = type;
  const res = await fetch(`/api/rank?type=${type}`);
  const data = await res.json();
  renderStats(data);
  renderList(data);
}

function renderStats(data) {
  const totalPoints = data.reduce((sum, m) => sum + m.total_points, 0);
  const topPlayer = data[0];

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card">
      <div class="value">${totalPoints}</div>
      <div class="label">总贡献积分</div>
    </div>
    <div class="stat-card">
      <div class="value">${data.filter(m => m.total_points > 0).length}</div>
      <div class="label">活跃成员</div>
    </div>
    <div class="stat-card">
      <div class="value">${topPlayer ? topPlayer.nickname : '--'}</div>
      <div class="label">当前榜首</div>
    </div>
  `;
}

function renderList(data) {
  document.getElementById('rankList').innerHTML = data.map((m, i) => `
    <div class="rank-item">
      <div class="rank-num">${String(i + 1).padStart(2, '0')}</div>
      <img class="rank-avatar" src="${m.avatar || '/images/members/default.jpg'}" alt="${m.nickname}">
      <div class="rank-info">
        <div class="rank-name">${m.nickname} <span style="color:var(--muted);font-size:12px;margin-left:8px">${m.role}</span></div>
        <div class="rank-reason">${m.last_reason ? '最近贡献：' + m.last_reason : ''}</div>
      </div>
      <div class="rank-points">${m.total_points}</div>
    </div>
  `).join('');
}

document.getElementById('tabBar').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadRank(btn.dataset.type);
});

loadRank('total');
