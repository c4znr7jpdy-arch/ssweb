const MAX_SIZE = 10 * 1024 * 1024;

let me = null;
let selectedFile = null;
let myPhotos = [];

const params = new URLSearchParams(location.search);
const initialTab = params.get('tab') || 'profile';
const adminTargetMemberId = params.get('memberId');

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

  const res = await fetch(path, {
    headers,
    credentials: 'include',
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
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
  el.style.color = isError ? '#ff9a9a' : '#c9a96e';
}

function setUploadMessage(text, isError = false) {
  uploadMessage.textContent = text;
  uploadMessage.style.color = isError ? '#ff9a9a' : '#c9a96e';
}

function setTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  document.querySelectorAll('.me-section').forEach(sec => {
    sec.classList.toggle('active', sec.dataset.section === tab);
  });
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
  document.getElementById('phrase').value = me.member?.phrase || '';

  const userBox = document.getElementById('userBox');
  userBox.innerHTML = `
    <a href="/me.html">${me.member?.nickname || me.user.username}</a>
    <button id="logoutBtn">退出</button>
  `;

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/login.html';
  });

  const targetMemberId = me.user.role === 'admin' && adminTargetMemberId
    ? adminTargetMemberId
    : me.member.id;

  document.getElementById('memberId').value = targetMemberId;
  document.getElementById('nicknameReadonly').value = me.user.role === 'admin' && adminTargetMemberId
    ? `管理员代传：成员ID ${adminTargetMemberId}`
    : me.member.nickname;
}

async function loadMyPhotos() {
  const memberId = me.member?.id;
  if (!memberId) return;

  const data = await api(`/api/albums?memberId=${encodeURIComponent(memberId)}`);
  myPhotos = data.items || [];
  renderMyPhotos();
}

function renderMyPhotos() {
  const grid = document.getElementById('myAlbumGrid');
  const count = document.getElementById('myPhotoCount');
  count.textContent = `${myPhotos.length} 张`;

  grid.innerHTML = '';

  if (!myPhotos.length) {
    grid.innerHTML = '<div class="panel empty">你还没有上传图片。</div>';
    return;
  }

  myPhotos.forEach((photo, index) => {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.innerHTML = `
      <button class="photo-delete" data-id="${photo.id}">删除</button>
      <img src="${photo.url}" alt="${photo.title || '我的相册'}" loading="lazy">
      <div class="photo-info">
        <div class="photo-no">MY PHOTO ${String(index + 1).padStart(2, '0')}</div>
        <div class="photo-title">${photo.title || '未命名图片'}</div>
        <div class="photo-meta">${photo.category || '个人'} · ${new Date(photo.createdAt).toLocaleDateString()}</div>
      </div>
    `;

    card.querySelector('.photo-delete').addEventListener('click', async () => {
      if (!confirm('确定删除这张图片？')) return;
      await api(`/api/albums/${photo.id}`, { method: 'DELETE' });
      await loadMyPhotos();
    });

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

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  dropInner.style.display = 'none';
  preview.style.display = 'block';
}

function bindUpload() {
  imageInput.addEventListener('change', () => handleFile(imageInput.files[0]));

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
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
          const percent = Math.round((event.loaded / event.total) * 80);
          progressBar.style.width = `${percent}%`;
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
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      await api('/api/members/me', {
        method: 'PUT',
        body: JSON.stringify({
          nickname: document.getElementById('nickname').value.trim(),
          phrase: document.getElementById('phrase').value.trim()
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
