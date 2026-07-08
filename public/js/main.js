(async () => {
  const gallery = document.getElementById('gallery');
  const hero = document.getElementById('heroTitle');

  const fallbackImages = [
    '/images/home-banner.jpg',
    '/images/banner2.jpg',
    '/images/banner3.jpg',
    '/images/banner4.jpg',
    '/images/banner5.jpg'
  ];

  fallbackImages.forEach(src => { const img = new Image(); img.src = src; });

  const pages = [
    { href: '/', tag: 'HOME', title: '盛世', desc: '同袍共赴山河远，一剑曾挡百万师。', action: '进入主页', mini: '盛业主页' },
    { href: '/members.html', tag: 'MEMBERS', title: '成员风采', desc: '记录社内核心成员、职位、常用玩法与高光截图。', action: '查看成员', mini: '成员风采' },
    { href: '/calendar.html', tag: 'CALENDAR', title: '活动日历', desc: '帮派活动、约战时间、副本安排、集体任务，一屏掌握。', action: '查看安排', mini: '活动日历' },
    { href: '/rank.html', tag: 'RANKINGS', title: '贡献榜', desc: '论功行赏，英雄留名。展示活跃、贡献、管理协作数据。', action: '查看榜单', mini: '贡献排行' },
    { href: '/tools/yysls/', tag: 'TOOLS', title: '装备工具', desc: '装备毕业率管理、OCR识别、方案对比，助你快速毕业。', action: '使用工具', mini: '装备工具', external: true }
  ];

  function createPanel(p, i, img) {
    return `
      <section class="panel" style="--img: url('${img}')" data-href="${p.href}"${p.external ? ' data-external="true"' : ''}>
        <span class="panel-border"></span>
        <div class="panel-mini">${p.mini}</div>
        <div class="panel-content">
          <div class="panel-index">${String(i + 1).padStart(2, '0')}</div>
          <div class="panel-tag">${p.tag}</div>
          <div class="panel-title">${p.title}</div>
          <div class="panel-line"></div>
          <div class="panel-desc">${p.desc}</div>
          <div class="panel-action">${p.action}</div>
        </div>
      </section>`;
  }

  try {
    const res = await fetch('/api/members');
    const members = await res.json();

    if (members.length === 0) {
      pages.forEach((p, i) => { gallery.innerHTML += createPanel(p, i, fallbackImages[i % fallbackImages.length]); });
    } else {
      pages.forEach((p, i) => { gallery.innerHTML += createPanel(p, i, fallbackImages[i % fallbackImages.length]); });
      members.slice(0, 3).forEach((m, i) => {
        const img = m.cover || m.avatar || fallbackImages[(pages.length + i) % fallbackImages.length];
        gallery.innerHTML += `
          <section class="panel" style="--img: url('${img}')" data-href="/member.html?id=${m.id}">
            <span class="panel-border"></span>
            <div class="panel-mini">${m.nickname}</div>
            <div class="panel-content">
              <div class="panel-index">${String(pages.length + i + 1).padStart(2, '0')}</div>
              <div class="panel-tag">${m.role}</div>
              <div class="panel-title">${m.nickname}</div>
              <div class="panel-line"></div>
              <div class="panel-desc">${m.signature || ''}</div>
              <div class="panel-action">查看详情</div>
            </div>
          </section>`;
      });
    }
  } catch (e) {
    console.error('加载失败:', e);
    pages.forEach((p, i) => { gallery.innerHTML += createPanel(p, i, fallbackImages[i % fallbackImages.length]); });
  }

  // Interaction
  const panels = [...gallery.querySelectorAll('.panel')];

  function activatePanel(panel) {
    panels.forEach(p => p.classList.remove('active'));
    panel.classList.add('active');
    gallery.classList.add('has-active');
  }

  panels.forEach(panel => {
    panel.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: hover)').matches) {
        hero.classList.add('is-hidden');
      }
    });
    panel.addEventListener('click', () => {
      const href = panel.dataset.href;
      if (href) {
        if (panel.dataset.external) {
          window.open(href, '_blank');
        } else {
          location.href = href;
        }
      }
    });
  });

  gallery.addEventListener('mouseleave', () => {
    if (window.matchMedia('(hover: hover)').matches) {
      hero.classList.remove('is-hidden');
      gallery.classList.remove('has-active');
      panels.forEach(p => p.classList.remove('active'));
    }
  });
})();
