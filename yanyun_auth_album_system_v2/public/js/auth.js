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

function setMessage(text, isError = false) {
  const el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#ff9a9a' : '#c9a96e';
}

async function loadMe() {
  try {
    const data = await api('/api/auth/me');
    const userBox = document.getElementById('userBox');

    if (userBox) {
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
    }

    return data;
  } catch {
    return { user: null, member: null };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadMe();

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const nickname = document.getElementById('nickname').value.trim();
      const password = document.getElementById('password').value.trim();

      try {
        await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, nickname, password })
        });

        setMessage('注册成功，正在进入成员列表。');
        setTimeout(() => location.href = '/members.html', 500);
      } catch (err) {
        setMessage(err.message, true);
      }
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();

      try {
        await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });

        setMessage('登录成功，正在进入成员列表。');
        setTimeout(() => location.href = '/members.html', 500);
      } catch (err) {
        setMessage(err.message, true);
      }
    });
  }
});
