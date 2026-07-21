const MAX_SIZE = 10 * 1024 * 1024;

let me = null;
let selectedFile = null;
let myPhotos = [];

const params = new URLSearchParams(location.search);
const initialTab = params.get('tab') || 'profile';

const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const dropInner = document.getElementById('dropInner');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const originSize = document.getElementById('originSize');
const compressedSize = document.getElementById('compressedSize');
const progressBar = document.getElementById('progressBar');
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');

async function api(path, options = {}) {
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(path, { headers, credentials: 'include', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

function safeUrl(value) {
  const url = String(value || '').trim();
  if (url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
  return '';
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '--';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function msg(id, text, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#ff9a9a' : '#00e5ff';
}

function setUploadMessage(text, isError = false) {
  uploadMessage.textContent = text;
  uploadMessage.style.color = isError ? '#ff9a9a' : '#00e5ff';
}

function setTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.me-section').forEach(sec => {
    sec.classList.toggle('active', sec.dataset.section === tab);
  });
}

function getManagedMemberId() {
  return me?.member?.id || '';
}

function renderUserBox() {
  const userBox = document.getElementById('userBox');
  userBox.replaceChildren();

  if (me.user.role === 'admin') {
    const adminLink = document.createElement('a');
    adminLink.href = '/admin.html?tab=events';
    adminLink.textContent = '活动管理';
    userBox.appendChild(adminLink);
  }

  const link = document.createElement('a');
  link.href = '/me.html';
  link.textContent = me.member?.nickname || me.user.username;
  userBox.appendChild(link);

  const logout = document.createElement('button');
  logout.id = 'logoutBtn';
  logout.type = 'button';
  logout.textContent = '退出';
  logout.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/login.html';
  });
  userBox.appendChild(logout);
}

async function loadMe() {
  me = await api('/api/auth/me');
  if (!me.user) {
    location.href = '/login.html';
    return;
  }

  document.getElementById('meName').textContent = me.member?.nickname || me.user.username;
  document.getElementById('meRole').textContent = `${me.member?.roleTitle || '成员'} · ${me.user.role === 'admin' ? '管理员' : '普通成员'}`;
  document.getElementById('nickname').value = me.member?.nickname || '';
  document.getElementById('phrase').value = me.member?.signature || me.member?.phrase || '';
  renderUserBox();

  if (me.user.role === 'admin' && !document.getElementById('adminEventLink')) {
    const adminEventLink = document.createElement('a');
    adminEventLink.id = 'adminEventLink';
    adminEventLink.className = 'tab-btn';
    adminEventLink.href = '/admin.html?tab=events';
    adminEventLink.textContent = '活动管理';
    document.querySelector('.tab-list')?.appendChild(adminEventLink);
  }

  const targetMemberId = getManagedMemberId();

  document.getElementById('memberId').value = targetMemberId;
  document.getElementById('nicknameReadonly').value = me.member?.nickname || '未绑定成员资料';

  const canUpload = Boolean(targetMemberId);
  uploadBtn.disabled = !canUpload;
  uploadBtn.textContent = '上传到我的相册';

  const notice = document.querySelector('.notice');
  if (notice) {
    notice.textContent = '图片只会保存到当前登录账号绑定的成员相册。';
  }

  if (!canUpload) {
    setUploadMessage('当前账号还没有绑定成员资料，暂时不能上传图片。', true);
  }
}

async function loadMyPhotos() {
  const memberId = getManagedMemberId();
  if (!memberId) return;
  const data = await api(`/api/albums?memberId=${encodeURIComponent(memberId)}`);
  myPhotos = data.items || [];
  renderMyPhotos();
}

function renderMyPhotos() {
  const grid = document.getElementById('myAlbumGrid');
  const count = document.getElementById('myPhotoCount');
  count.textContent = `${myPhotos.length} 张`;
  grid.replaceChildren();

  if (!myPhotos.length) {
    const empty = document.createElement('div');
    empty.className = 'panel empty';
    empty.textContent = '你还没有上传图片。';
    grid.appendChild(empty);
    return;
  }

  myPhotos.forEach((photo, index) => {
    const card = document.createElement('article');
    card.className = 'photo-card';

    const del = document.createElement('button');
    del.className = 'photo-delete';
    del.type = 'button';
    del.textContent = '删除';
    del.addEventListener('click', async () => {
      if (!confirm('确定删除这张图片？')) return;
      await api(`/api/albums/${encodeURIComponent(photo.id)}`, { method: 'DELETE' });
      await loadMyPhotos();
    });
    card.appendChild(del);

    const img = document.createElement('img');
    img.src = safeUrl(photo.url);
    img.alt = photo.title || '我的相册';
    img.loading = 'lazy';
    card.appendChild(img);

    const info = document.createElement('div');
    info.className = 'photo-info';

    const no = document.createElement('div');
    no.className = 'photo-no';
    no.textContent = `MY PHOTO ${String(index + 1).padStart(2, '0')}`;
    info.appendChild(no);

    const title = document.createElement('div');
    title.className = 'photo-title';
    title.textContent = photo.title || '未命名图片';
    info.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'photo-meta';
    meta.textContent = `${photo.category || '个人'} · ${new Date(photo.createdAt).toLocaleDateString()}`;
    info.appendChild(meta);

    card.appendChild(info);
    grid.appendChild(card);
  });
}

function handleFile(file) {
  if (!file) return;
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    setUploadMessage('只支持 JPG / PNG / WEBP 图片。', true);
    return;
  }
  if (file.size > MAX_SIZE) {
    setUploadMessage('图片超过 10M，请重新选择。', true);
    return;
  }

  selectedFile = file;
  originSize.textContent = formatSize(file.size);
  compressedSize.textContent = '等待上传';
  progressBar.style.width = '0%';
  setUploadMessage('图片已选择，可以上传。');

  previewImg.src = URL.createObjectURL(file);
  dropInner.style.display = 'none';
  preview.style.display = 'block';
}

function bindUpload() {
  imageInput.addEventListener('change', () => handleFile(imageInput.files[0]));
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    handleFile(event.dataTransfer.files[0]);
  });

  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      setUploadMessage('请先选择图片。', true);
      return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('memberId', document.getElementById('memberId').value.trim());
    formData.append('title', document.getElementById('title').value.trim() || selectedFile.name);
    formData.append('category', document.getElementById('category').value);
    formData.append('description', document.getElementById('description').value.trim());

    uploadBtn.disabled = true;
    uploadBtn.textContent = '上传中...';
    setUploadMessage('正在上传并压缩，请稍等。');

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/albums/upload');
        xhr.withCredentials = true;

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          progressBar.style.width = `${Math.round((event.loaded / event.total) * 80)}%`;
        };

        xhr.onload = () => {
          let data = {};
          try { data = JSON.parse(xhr.responseText); } catch (_) {}
          if (xhr.status >= 200 && xhr.status < 300) {
            progressBar.style.width = '100%';
            compressedSize.textContent = formatSize(data.compressedSize);
            setUploadMessage(`上传成功，已压缩为 ${formatSize(data.compressedSize)}。`);
            resolve(data);
          } else {
            reject(new Error(data.message || '上传失败'));
          }
        };
        xhr.onerror = () => reject(new Error('网络异常，上传失败'));
        xhr.send(formData);
      });

      await loadMyPhotos();
    } catch (err) {
      setUploadMessage(err.message, true);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = '上传到我的相册';
    }
  });
}

function bindProfile() {
  document.getElementById('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/members/me', {
        method: 'PUT',
        body: JSON.stringify({
          nickname: document.getElementById('nickname').value.trim(),
          signature: document.getElementById('phrase').value.trim()
        })
      });
      msg('profileMessage', '资料已保存。');
      await loadMe();
    } catch (err) {
      msg('profileMessage', err.message, true);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadMe();
  await loadMyPhotos();
  bindProfile();
  bindUpload();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });
  setTab(initialTab);
});
