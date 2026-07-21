const MAX_SIZE = 10 * 1024 * 1024;

const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const dropInner = document.getElementById('dropInner');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const originSize = document.getElementById('originSize');
const compressedSize = document.getElementById('compressedSize');
const progressBar = document.getElementById('progressBar');
const uploadBtn = document.getElementById('uploadBtn');
const message = document.getElementById('message');

const params = new URLSearchParams(location.search);
const urlMemberId = params.get('memberId');
const urlNickname = params.get('nickname');

let selectedFile = null;
let me = null;

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '--';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#ff9a9a' : '#c9a96e';
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

async function initUser() {
  const data = await api('/api/auth/me');
  me = data;

  if (!data.user) {
    setMessage('请先登录后再上传图片。', true);
    uploadBtn.disabled = true;
    setTimeout(() => location.href = '/login.html', 900);
    return;
  }

  const userBox = document.getElementById('userBox');
  userBox.innerHTML = `
    <span style="color:rgba(255,255,255,.54);font-size:13px;letter-spacing:2px;">${data.member?.nickname || data.user.username}</span>
    <button id="logoutBtn">退出</button>
  `;

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/login.html';
  });

  document.getElementById('memberId').value = urlMemberId || data.member?.id || '';
  document.getElementById('nickname').value = urlNickname || data.member?.nickname || '';
}

function handleFile(file) {
  if (!file) return;

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    setMessage('只支持 JPG / PNG / WEBP 图片。', true);
    return;
  }

  if (file.size > MAX_SIZE) {
    setMessage('图片超过 10M，请重新选择。', true);
    return;
  }

  selectedFile = file;
  originSize.textContent = formatSize(file.size);
  compressedSize.textContent = '等待上传';
  progressBar.style.width = '0%';
  setMessage('图片已选择，可以上传。');

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  dropInner.style.display = 'none';
  preview.style.display = 'block';
}

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
    setMessage('请先选择图片。', true);
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
  setMessage('正在上传并压缩，请稍等。');

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
          setMessage(`上传成功，已压缩为 ${formatSize(data.compressedSize)}。`);
          resolve(data);
        } else {
          reject(new Error(data.message || '上传失败'));
        }
      };

      xhr.onerror = () => reject(new Error('网络异常，上传失败'));
      xhr.send(formData);
    });
  } catch (err) {
    setMessage(err.message, true);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = '上传到服务器';
  }
});

initUser().catch(err => setMessage(err.message, true));
