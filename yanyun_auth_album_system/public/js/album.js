const grid = document.getElementById('albumGrid');
const albumCount = document.getElementById('albumCount');
const filters = [...document.querySelectorAll('.filter')];

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxNo = document.getElementById('lightboxNo');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxMeta = document.getElementById('lightboxMeta');
const closeLightbox = document.getElementById('closeLightbox');
const prevPhoto = document.getElementById('prevPhoto');
const nextPhoto = document.getElementById('nextPhoto');

const params = new URLSearchParams(location.search);
const memberId = params.get('memberId') || params.get('id') || '';

let photos = [];
let visiblePhotos = [];
let activeIndex = 0;
let currentCategory = '全部';

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'include', ...options });
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
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function render() {
  visiblePhotos = currentCategory === '全部'
    ? photos
    : photos.filter(item => item.category === currentCategory);

  albumCount.textContent = `${visiblePhotos.length} 张`;
  grid.innerHTML = '';

  if (!visiblePhotos.length) {
    grid.innerHTML = '<div class="panel empty">暂无图片，登录后可以上传成员相册。</div>';
    return;
  }

  visiblePhotos.forEach((photo, index) => {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${photo.url}" alt="${photo.title || '成员相册'}" loading="lazy">
      <div class="photo-info">
        <div class="photo-no">PHOTO ${String(index + 1).padStart(2, '0')}</div>
        <div class="photo-title">${photo.title || '未命名图片'}</div>
        <div class="photo-meta">${photo.nickname || ''} · ${photo.category || '个人'} · ${formatDate(photo.createdAt)}</div>
      </div>
    `;
    card.addEventListener('click', () => openLightbox(index));
    grid.appendChild(card);
  });
}

function openLightbox(index) {
  activeIndex = index;
  const photo = visiblePhotos[activeIndex];
  if (!photo) return;

  lightboxImg.src = photo.url;
  lightboxNo.textContent = `PHOTO ${String(activeIndex + 1).padStart(2, '0')}`;
  lightboxTitle.textContent = photo.title || '未命名图片';
  lightboxMeta.innerHTML = `
    成员：${photo.nickname || '未知'}<br>
    分类：${photo.category || '个人'}<br>
    时间：${formatDate(photo.createdAt)}<br><br>
    ${photo.description || '暂无说明'}
  `;

  lightbox.classList.add('open');
}

function close() {
  lightbox.classList.remove('open');
}

function move(step) {
  if (!visiblePhotos.length) return;
  activeIndex = (activeIndex + step + visiblePhotos.length) % visiblePhotos.length;
  openLightbox(activeIndex);
}

closeLightbox.addEventListener('click', close);
prevPhoto.addEventListener('click', () => move(-1));
nextPhoto.addEventListener('click', () => move(1));

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) close();
});

window.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft') move(-1);
  if (e.key === 'ArrowRight') move(1);
});

filters.forEach(btn => {
  btn.addEventListener('click', () => {
    filters.forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    render();
  });
});

async function loadPhotos() {
  const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
  const data = await api(`/api/albums${query}`);
  photos = data.items || [];
  render();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadMe();
  await loadPhotos();
});
