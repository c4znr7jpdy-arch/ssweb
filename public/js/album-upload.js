const MAX_SIZE = 10 * 1024 * 1024;

const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const dropInner = document.getElementById('dropInner');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const simpleForm = document.getElementById('simpleForm');
const uploadBtn = document.getElementById('uploadBtn');
const message = document.getElementById('message');

const params = new URLSearchParams(window.location.search);
const memberId = params.get('memberId') || '2';
const nickname = params.get('nickname') || '';

let selectedFile = null;

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#ff9a9a' : '#00e5ff';
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
  previewImg.src = URL.createObjectURL(file);
  dropInner.style.display = 'none';
  preview.style.display = 'block';
  simpleForm.style.display = 'block';
}

imageInput.addEventListener('change', () => handleFile(imageInput.files[0]));

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragover');
  handleFile(event.dataTransfer.files[0]);
});

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) {
    setMessage('请先选择图片。', true);
    return;
  }

  const formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('memberId', memberId);
  formData.append('nickname', nickname);
  formData.append('category', document.getElementById('category').value);

  uploadBtn.disabled = true;
  uploadBtn.textContent = '上传中...';

  try {
    const res = await fetch('/api/albums/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || '上传失败');

    setMessage('上传成功，正在跳转...');
    setTimeout(() => {
      window.location.href = `/album.html?memberId=${encodeURIComponent(memberId)}`;
    }, 800);
  } catch (err) {
    setMessage(err.message, true);
    uploadBtn.disabled = false;
    uploadBtn.textContent = '上传';
  }
});
