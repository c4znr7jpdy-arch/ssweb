async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || '请求失败');
    error.code = data.code;
    throw error;
  }
  return data;
}

function setMessage(text, isError = false) {
  const el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#ff9a9a' : '#00e5ff';
}

let authenticatedUser = null;

function safeNextPath(user = authenticatedUser) {
  const next = new URLSearchParams(location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

function showPasswordModal() {
  const modal = document.getElementById('passwordModal');
  if (!modal) return;
  modal.hidden = false;
  document.getElementById('newPassword')?.focus();
}

async function loadMe() {
  try {
    const data = await api('/api/auth/me');
    authenticatedUser = data.user || null;
    const userBox = document.getElementById('userBox');

    if (userBox) {
      userBox.replaceChildren();
      if (data.user) {
        if (data.user.role === 'admin') {
          const adminLink = document.createElement('a');
          adminLink.href = '/admin.html?tab=events';
          adminLink.textContent = '活动管理';
          userBox.appendChild(adminLink);
        }

        const link = document.createElement('a');
        link.href = '/me.html';
        link.textContent = data.member?.nickname || data.user.username;
        userBox.appendChild(link);

        const button = document.createElement('button');
        button.id = 'logoutBtn';
        button.type = 'button';
        button.textContent = '退出';
        button.addEventListener('click', async () => {
          await api('/api/auth/logout', { method: 'POST' });
          location.href = '/login.html';
        });
        userBox.appendChild(button);
        if (data.user.mustChangePassword) showPasswordModal();
      } else {
        userBox.innerHTML = '<a href="/login.html">登录</a><a href="/register.html">注册</a>';
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
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const username = document.getElementById('username').value.trim();
      const nickname = document.getElementById('nickname').value.trim();
      const password = document.getElementById('password').value;
      const inviteCode = document.getElementById('inviteCode').value.trim();

      try {
        await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, nickname, password, inviteCode })
        });

        setMessage('注册成功，正在跳转。');
        setTimeout(() => location.href = '/', 500);
      } catch (err) {
        setMessage(err.message, true);
      }
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      try {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        authenticatedUser = data.user || null;

        if (data.mustChangePassword) {
          setMessage('登录成功，请先设置新密码。');
          showPasswordModal();
          return;
        }

        setMessage('登录成功，正在跳转。');
        setTimeout(() => location.href = safeNextPath(data.user), 500);
      } catch (err) {
        setMessage(err.message, true);
      }
    });
  }

  const passwordChangeForm = document.getElementById('passwordChangeForm');
  if (passwordChangeForm) {
    passwordChangeForm.addEventListener('submit', async event => {
      event.preventDefault();
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const message = document.getElementById('passwordMessage');

      try {
        await api('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ newPassword, confirmPassword })
        });
        message.textContent = '密码设置成功，正在进入网站。';
        message.style.color = '#00e5ff';
        setTimeout(() => location.href = safeNextPath(), 500);
      } catch (err) {
        message.textContent = err.message;
        message.style.color = '#ff9a9a';
      }
    });
  }
});
