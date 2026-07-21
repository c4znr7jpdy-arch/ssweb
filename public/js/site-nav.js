(() => {
  const desktopNav = document.querySelector('body > nav.nav');
  const topbar = document.querySelector('body > header.topbar');
  const root = desktopNav || topbar;
  if (!root) return;

  let menu;
  let managedUser = null;
  if (desktopNav) {
    const links = root.querySelector(':scope > .nav-links');
    if (!links) return;

    menu = document.createElement('div');
    menu.className = 'site-menu';
    root.insertBefore(menu, links);
    menu.appendChild(links);

    let user = root.querySelector(':scope > .nav-user');
    if (!user) {
      user = document.createElement('div');
      user.className = 'nav-user';
      user.dataset.siteNavManaged = 'true';
      managedUser = user;
    }
    menu.appendChild(user);
  } else {
    menu = root.querySelector(':scope > nav.nav');
    if (!menu) return;
    menu.classList.add('site-menu');
  }

  root.classList.add('site-nav');
  menu.id = menu.id || 'siteMenu';

  const toggle = document.createElement('button');
  toggle.className = 'site-nav-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '打开导航菜单');
  toggle.setAttribute('aria-controls', menu.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  root.insertBefore(toggle, menu);

  const setOpen = open => {
    root.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  };

  toggle.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false);
  });
  document.addEventListener('click', event => {
    if (!root.contains(event.target)) setOpen(false);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setOpen(false);
  }, { passive: true });

  if (managedUser) {
    const addLink = (href, label) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      managedUser.appendChild(link);
    };

    const renderAccount = user => {
      managedUser.replaceChildren();
      if (!user) {
        addLink('/login.html', '登录');
        addLink('/register.html', '注册');
        return;
      }

      if (user.role === 'admin') addLink('/admin.html?tab=events', '活动管理');
      addLink('/me.html', '个人中心');
      const logout = document.createElement('button');
      logout.className = 'logout-btn';
      logout.type = 'button';
      logout.textContent = '退出';
      logout.addEventListener('click', async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } finally {
          renderAccount(null);
          setOpen(false);
        }
      });
      managedUser.appendChild(logout);
    };

    fetch('/api/auth/me', { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .then(data => renderAccount(data?.user || null))
      .catch(() => renderAccount(null));
  }
})();
