const grid = document.getElementById('albumGrid');
const albumCount = document.getElementById('albumCount');
const filters = [...document.querySelectorAll('.filter')];
const ownerUploadBtn = document.getElementById('ownerUploadBtn');
const userBox = document.getElementById('userBox');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxNo = document.getElementById('lightboxNo');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxMeta = document.getElementById('lightboxMeta');
const closeLightbox = document.getElementById('closeLightbox');
const prevPhoto = document.getElementById('prevPhoto');
const nextPhoto = document.getElementById('nextPhoto');

const params = new URLSearchParams(window.location.search);
const memberId = params.get('memberId') || params.get('id') || '2';

let photos = [];
let visiblePhotos = [];
let activeIndex = 0;
let currentCategory = '全部';
let currentUser = null;

function safeUrl(value) {
  const url = String(value || '').trim();
  if (url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
  return '';
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function canDelete() {
  return Boolean(currentUser?.isOwner || currentUser?.isAdmin);
}

function makeText(className, value, tagName = 'div') {
  const el = document.createElement(tagName);
  el.className = className;
  el.textContent = value;
  return el;
}

function render() {
  visiblePhotos = currentCategory === '全部'
    ? photos
    : photos.filter(item => item.category === currentCategory);

  albumCount.textContent = `${visiblePhotos.length} 张`;
  grid.replaceChildren();

  if (!visiblePhotos.length) {
    const empty = makeText('panel empty', '暂无图片，先上传一张成员相册。');
    grid.appendChild(empty);
    return;
  }

  const showDelete = canDelete();

  visiblePhotos.forEach((photo, index) => {
    const card = document.createElement('article');
    card.className = 'photo-card';

    const image = document.createElement('img');
    image.src = safeUrl(photo.url);
    image.alt = photo.title || '成员相册';
    image.loading = 'lazy';
    card.appendChild(image);

    if (showDelete) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'photo-delete';
      deleteBtn.title = '删除';
      deleteBtn.type = 'button';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!confirm('确定删除这张照片？')) return;
        try {
          const res = await fetch(`/api/albums/${encodeURIComponent(photo.id)}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          if (!res.ok) throw new Error('删除失败');
          photos = photos.filter(item => item.id !== photo.id);
          render();
        } catch (err) {
          alert(err.message);
        }
      });
      card.appendChild(deleteBtn);
    }

    const info = document.createElement('div');
    info.className = 'photo-info';
    info.appendChild(makeText('photo-no', `PHOTO ${String(index + 1).padStart(2, '0')}`));
    info.appendChild(makeText('photo-title', photo.title || '未命名图片'));
    info.appendChild(makeText(
      'photo-meta',
      `${photo.nickname || ''} · ${photo.category || '个人'} · ${formatDate(photo.createdAt)}`
    ));
    card.appendChild(info);

    card.addEventListener('click', () => openLightbox(index));
    grid.appendChild(card);
  });
}

function openLightbox(index) {
  activeIndex = index;
  const photo = visiblePhotos[activeIndex];
  if (!photo) return;

  lightboxImg.src = safeUrl(photo.url);
  lightboxNo.textContent = `PHOTO ${String(activeIndex + 1).padStart(2, '0')}`;
  lightboxTitle.textContent = photo.title || '未命名图片';
  lightboxMeta.textContent = [
    `成员：${photo.nickname || '未知'}`,
    `分类：${photo.category || '个人'}`,
    `时间：${formatDate(photo.createdAt)}`,
    '',
    photo.description || '暂无说明'
  ].join('\n');

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

lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) close();
});

window.addEventListener('keydown', (event) => {
  if (!lightbox.classList.contains('open')) return;
  if (event.key === 'Escape') close();
  if (event.key === 'ArrowLeft') move(-1);
  if (event.key === 'ArrowRight') move(1);
});

filters.forEach(btn => {
  btn.addEventListener('click', () => {
    filters.forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    render();
  });
});

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return;

    const data = await res.json();
    const user = data.user || null;
    const member = data.member || null;

    if (user) {
      currentUser = {
        ...user,
        member,
        isAdmin: user.role === 'admin',
        isOwner: member ? String(member.id) === String(memberId) : false
      };
      userBox.replaceChildren();
      if (user.role === 'admin') {
        const adminLink = document.createElement('a');
        adminLink.href = '/admin.html?tab=events';
        adminLink.style.color = 'var(--gold)';
        adminLink.textContent = '活动管理';
        userBox.appendChild(adminLink);
      }
      const link = document.createElement('a');
      link.href = '/me.html';
      link.style.color = 'var(--gold)';
      link.textContent = member?.nickname || user.username;
      userBox.appendChild(link);
    } else {
      currentUser = null;
      userBox.innerHTML = '<a href="/login.html">登录</a><a href="/register.html">注册</a>';
    }

    if (currentUser?.isOwner) {
      ownerUploadBtn.href = '/me.html?tab=upload';
      ownerUploadBtn.style.display = '';
    }
  } catch {
    currentUser = null;
  }
}

async function loadPhotos() {
  try {
    const res = await fetch(`/api/albums?memberId=${encodeURIComponent(memberId)}`);
    if (!res.ok) throw new Error('接口异常');
    const data = await res.json();
    photos = data.items || [];
  } catch {
    photos = [];
  }

  render();
}

async function init() {
  await checkAuth();
  await loadPhotos();
}

init();
