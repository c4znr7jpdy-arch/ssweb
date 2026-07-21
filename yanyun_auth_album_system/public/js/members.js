async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

async function loadMe() {
  const data = await api('/api/auth/me');
  const userBox = document.getElementById('userBox');

  if (data.user) {
    userBox.innerHTML = `
      <span style="color:rgba(255,255,255,.54);font-size:13px;letter-spacing:2px;">${data.member?.nickname || data.user.username}</span>
      <button id="logoutBtn">退出</button>
    `;

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' });
      location.href = '/login.html';
    });
  } else {
    userBox.innerHTML = `<a href="/login.html">登录</a><a href="/register.html">注册</a>`;
  }

  return data;
}

async function loadMembers() {
  const data = await api('/api/members');
  const grid = document.getElementById('membersGrid');
  const count = document.getElementById('memberCount');

  count.textContent = `${data.items.length} 人`;
  grid.innerHTML = '';

  data.items.forEach((m, index) => {
    const card = document.createElement('article');
    card.className = 'panel member-card';
    card.innerHTML = `
      <div class="member-no">MEMBER ${String(index + 1).padStart(2, '0')}</div>
      <div class="member-name">${m.nickname}</div>
      <div class="member-role">${m.roleTitle || '成员'} · ${m.role === 'admin' ? '管理员' : '普通成员'}</div>
      <div class="member-phrase">${m.phrase || '这个人很神秘，还没有留下个人短语。'}</div>
      <div class="member-actions">
        <a class="btn" href="/album.html?memberId=${m.id}">相册 ${m.photoCount || 0}</a>
        <a class="btn btn-primary" href="/album-upload.html?memberId=${m.id}&nickname=${encodeURIComponent(m.nickname)}">上传</a>
      </div>
    `;

    grid.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadMe();
  await loadMembers();
});
