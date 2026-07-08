(async () => {
  const gallery = document.getElementById('gallery');

  const fallbackImages = [
    '/images/home-banner.jpg',
    'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=90',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=90',
    'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=90',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=90'
  ];

  try {
    const res = await fetch('/api/members');
    const members = await res.json();

    if (members.length === 0) {
      const titles = ['盛世', '成员风采', '活动日历', '贡献榜', '游戏攻略'];
      const descs = [
        '同袍共赴山河远，一剑曾挡百万师',
        '江湖路远，幸得同行',
        '排兵布阵，共赴盛宴',
        '论功行赏，英雄留名',
        '独门秘籍，倾囊相授'
      ];
      const tags = ['HOME', 'MEMBERS', 'CALENDAR', 'RANKINGS', 'FEATURES'];

      for (let i = 0; i < 5; i++) {
        gallery.innerHTML += `
          <section class="panel" style="--img: url('${fallbackImages[i]}')">
            <div class="panel-content">
              <div class="panel-tag">${tags[i]}</div>
              <div class="panel-title">${titles[i]}</div>
              <div class="panel-line"></div>
              <div class="panel-desc">${descs[i]}</div>
            </div>
          </section>`;
      }
    } else {
      members.slice(0, 8).forEach((m, i) => {
        const img = m.cover || m.avatar || fallbackImages[i % fallbackImages.length];
        gallery.innerHTML += `
          <section class="panel" style="--img: url('${img}')" onclick="location.href='/member.html?id=${m.id}'">
            <div class="panel-content">
              <div class="panel-tag">${m.role}</div>
              <div class="panel-title">${m.nickname}</div>
              <div class="panel-line"></div>
              <div class="panel-desc">${m.signature || ''}</div>
            </div>
          </section>`;
      });
    }
  } catch (e) {
    console.error('加载成员失败:', e);
  }
})();
