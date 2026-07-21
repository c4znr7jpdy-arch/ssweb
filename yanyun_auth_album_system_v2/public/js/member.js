async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

const params = new URLSearchParams(location.search);
const memberId = params.get('id') || params.get('memberId') || '1';

async function loadMe() {
  const data = await api('/api/auth/me');
  const userBox = document.getElementById('userBox');

  if (data.user) {
    userBox.innerHTML = `
      <a href="/me.html">${data.member?.nickname || data.user.username}</a>
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

async function loadMember() {
  const data = await api(`/api/members/${memberId}`);
  const m = data.item;

  document.title = `${m.nickname}｜成员详情`;
  document.getElementById('detailNo').textContent = `MEMBER #${String(m.id).padStart(3, '0')}`;
  document.getElementById('detailName').textContent = m.nickname;
  document.getElementById('detailPhrase').textContent = m.phrase || '这个人很神秘，还没有留下个人短语。';

  document.getElementById('cardNickname').textContent = m.nickname;
  document.getElementById('cardRole').textContent = m.roleTitle || '成员';
  document.getElementById('cardAccount').textContent = m.username;
  document.getElementById('cardPhotos').textContent = `${m.photoCount || 0} 张`;

  document.getElementById('albumBtn').href = `/album.html?memberId=${m.id}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadMe();
  await loadMember();
});
