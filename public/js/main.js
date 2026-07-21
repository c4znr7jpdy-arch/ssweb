(async () => {
  const gallery = document.getElementById('gallery');
  const hero = document.getElementById('heroTitle');
  const userBox = document.getElementById('userBox');
  const intro = document.getElementById('cinematicIntro');
  const ambientLayer = document.getElementById('ambientLayer');
  const cursorReticle = document.getElementById('cursorReticle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const precisePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let currentUser = null;
  let isLeaving = false;

  const fallbackImages = [
    '/images/home-banner.webp',
    '/images/banner2.webp',
    '/images/banner3.webp',
    '/images/banner4.webp',
    '/images/banner5.webp'
  ];

  function preloadImage(url) {
    return new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        image.onload = null;
        image.onerror = null;
        resolve(url);
      };
      const timeoutId = window.setTimeout(finish, 7000);
      image.decoding = 'async';
      image.onload = finish;
      image.onerror = finish;
      image.src = url;
      if (image.complete) finish();
    });
  }

  function preloadImages(urls) {
    return Promise.all([...new Set(urls)].map(preloadImage));
  }

  // 页面开始执行时就下载 5 张兜底 Banner，不等待成员接口。
  const fallbackBannerPreload = preloadImages(fallbackImages);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function safeUrl(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    try {
      if (raw.startsWith('/')) {
        if (raw.startsWith('//')) return fallback;
        const url = new URL(raw, location.origin);
        return url.origin === location.origin
          ? `${url.pathname}${url.search}${url.hash}`
          : fallback;
      }

      const url = new URL(raw);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
    } catch {
      return fallback;
    }
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setupIntro() {
    if (!intro || reducedMotion) {
      intro?.classList.add('is-skipped');
      return Promise.resolve();
    }

    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fallbackTimer);
        intro.removeEventListener('animationend', handleAnimationEnd);
        resolve();
      };
      const handleAnimationEnd = event => {
        if (event.target === intro && event.animationName === 'intro-exit') finish();
      };
      const fallbackTimer = window.setTimeout(finish, 2800);
      intro.addEventListener('animationend', handleAnimationEnd);
    });
  }

  function createAmbientDust() {
    if (!ambientLayer || reducedMotion) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 18; index += 1) {
      const dust = makeElement('i', 'dust');
      dust.style.setProperty('--x', `${4 + Math.random() * 92}%`);
      dust.style.setProperty('--size', `${1 + Math.random() * 2}px`);
      dust.style.setProperty('--duration', `${10 + Math.random() * 12}s`);
      dust.style.setProperty('--delay', `${-Math.random() * 18}s`);
      dust.style.setProperty('--drift', `${-45 + Math.random() * 90}px`);
      fragment.appendChild(dust);
    }
    ambientLayer.appendChild(fragment);
  }

  function navigateWithTransition(href) {
    if (isLeaving) return;
    isLeaving = true;
    document.body.classList.add('is-leaving');
    window.setTimeout(() => {
      window.location.href = href;
    }, reducedMotion ? 0 : 460);
  }

  // 浏览器后退可能从 bfcache 恢复页面，此时离场遮罩也会被一并恢复。
  window.addEventListener('pageshow', () => {
    isLeaving = false;
    document.body.classList.remove('is-leaving');
  });

  function setupPointerEffects() {
    if (!precisePointer || reducedMotion || !cursorReticle) return;

    let targetX = -100;
    let targetY = -100;
    let cursorX = -100;
    let cursorY = -100;

    window.addEventListener('pointermove', event => {
      targetX = event.clientX;
      targetY = event.clientY;
      document.body.classList.add('has-pointer');

      const normalizedX = event.clientX / window.innerWidth - .5;
      const normalizedY = event.clientY / window.innerHeight - .5;
      document.documentElement.style.setProperty('--gallery-x', `${normalizedX * -7}px`);
      document.documentElement.style.setProperty('--gallery-y', `${normalizedY * -5}px`);
      document.documentElement.style.setProperty('--scene-x', `${normalizedX * 10}px`);
      document.documentElement.style.setProperty('--scene-y', `${normalizedY * 7}px`);
      document.body.classList.toggle(
        'pointer-over-action',
        Boolean(event.target.closest('a, button, .panel'))
      );
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', () => {
      document.body.classList.remove('has-pointer', 'pointer-over-action');
    });

    const updateCursor = () => {
      cursorX += (targetX - cursorX) * .2;
      cursorY += (targetY - cursorY) * .2;
      cursorReticle.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
      requestAnimationFrame(updateCursor);
    };
    requestAnimationFrame(updateCursor);
  }

  const introFinished = setupIntro().then(() => {
    document.body.classList.add('intro-finished');
  });
  createAmbientDust();
  setupPointerEffects();

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      currentUser = data.user || null;
    } catch {
      currentUser = null;
    }
    renderUserBox();
  }

  function renderUserBox() {
    if (!userBox) return;
    if (currentUser) {
      userBox.innerHTML = `
        ${currentUser.role === 'admin' ? '<a href="/admin.html?tab=events">活动管理</a>' : ''}
        <a href="/me.html">个人中心</a>
        <span class="username">${escapeHtml(currentUser.username)}</span>
        <button class="logout-btn" id="logoutBtn">退出</button>
      `;
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        currentUser = null;
        renderUserBox();
      });
    } else {
      userBox.innerHTML = `
        <a href="/login.html">登录</a>
        <a href="/register.html">注册</a>
      `;
    }
  }

  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (event) => {
      if (link.target === '_blank') return;
      if (link.pathname === window.location.pathname) return;
      event.preventDefault();
      navigateWithTransition(link.href);
    });
  });

  function createPanel(member, index, image) {
    const panelImage = safeUrl(image, fallbackImages[index % fallbackImages.length]);
    const panel = makeElement('section', 'panel');
    panel.style.setProperty('--img', `url("${panelImage}")`);
    panel.dataset.href = `/member.html?id=${encodeURIComponent(member.id)}&from=home`;
    panel.tabIndex = 0;
    panel.setAttribute('role', 'link');
    panel.setAttribute('aria-label', `查看成员 ${member.nickname}`);
    panel.appendChild(makeElement('span', 'panel-border'));
    panel.appendChild(makeElement('div', 'panel-index', String(index + 1).padStart(2, '0')));
    panel.appendChild(makeElement('div', 'panel-mini', member.nickname));

    const content = makeElement('div', 'panel-content');
    content.appendChild(makeElement('div', 'panel-tag', member.role || '成员'));
    content.appendChild(makeElement('div', 'panel-title', member.nickname));
    content.appendChild(makeElement('div', 'panel-line'));
    content.appendChild(makeElement('div', 'panel-desc', member.signature || ''));
    content.appendChild(makeElement('div', 'panel-action', '查看详情'));
    panel.appendChild(content);
    return panel;
  }

  const fallbackMembers = [
    { id: 1, nickname: '盛世', role: 'HOME', signature: '以盛世之名，聚同袍之义。' },
    { id: 2, nickname: '成员风采', role: 'MEMBERS', signature: '记录社内成员、职位、玩法与高光瞬间。' },
    { id: 3, nickname: '活动日历', role: 'CALENDAR', signature: '活动、约战、副本安排，一屏掌握。' },
    { id: 4, nickname: '贡献榜', role: 'RANKINGS', signature: '活跃、贡献、协作数据清晰展示。' },
    { id: 5, nickname: '装备工具', role: 'TOOLS', signature: '装备毕业率管理与 OCR 识别工具。' }
  ];

  let activeBannerPreload = fallbackBannerPreload;
  try {
    const res = await fetch('/api/members');
    const members = await res.json();
    const featuredIds = [1, 2, 3, 4, 5];
    const featuredMembers = featuredIds
      .map(id => members.find(member => Number(member.id) === id))
      .filter(Boolean);
    const list = featuredMembers.length === featuredIds.length
      ? featuredMembers
      : (members.length ? members.slice(0, 5) : fallbackMembers);
    const bannerImages = list.map((member, index) => safeUrl(
      member.cover || member.avatar,
      fallbackImages[index % fallbackImages.length]
    ));
    activeBannerPreload = Promise.all([
      fallbackBannerPreload,
      preloadImages(bannerImages)
    ]);
    gallery.replaceChildren(...list.map((member, index) => (
      createPanel(member, index, bannerImages[index])
    )));
  } catch (error) {
    console.error('加载成员失败:', error);
    gallery.replaceChildren(...fallbackMembers.map((member, index) => (
      createPanel(member, index, fallbackImages[index])
    )));
  }

  const panels = [...gallery.querySelectorAll('.panel')];

  panels.forEach(panel => {
    panel.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: hover)').matches) {
        hero.classList.add('is-hidden');
      }
    });
    panel.addEventListener('click', () => {
      navigateWithTransition(panel.dataset.href);
    });
    panel.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      panel.click();
    });
  });

  gallery.addEventListener('mouseleave', () => {
    if (window.matchMedia('(hover: hover)').matches) {
      hero.classList.remove('is-hidden');
      gallery.classList.remove('has-active');
      panels.forEach(panel => panel.classList.remove('active'));
    }
  });

  await checkAuth();
  requestAnimationFrame(() => {
    document.body.classList.add('is-ready');
    window.setTimeout(() => document.body.classList.add('entrance-done'), reducedMotion ? 0 : 1750);
  });

  const bannersPreloaded = activeBannerPreload.then(() => {
    document.body.classList.add('banners-preloaded');
  });
  await Promise.all([introFinished, bannersPreloaded]);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.add('banners-ready'));
  });
})();
