(async () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { location.href = '/members.html'; return; }

  const img = document.getElementById('memberImage');
  const panel = document.getElementById('infoPanel');

  try {
    const res = await fetch(`/api/members/${id}`);
    if (!res.ok) throw new Error('成员不存在');
    const m = await res.json();

    img.src = m.cover || m.avatar || '/images/members/default.jpg';
    img.alt = m.nickname;

    const lines = [
      { label: 'ID', value: `#${String(m.id).padStart(3, '0')}` },
      { label: '昵称', value: m.nickname },
      { label: '流派', value: m.tags || '未知' },
      { label: '签名', value: m.signature || '这个人很懒，什么都没写', className: 'signature' }
    ];

    panel.innerHTML = lines.map((l, i) => `
      <div class="typewriter-line" style="transition-delay: ${0.3 + i * 0.4}s">
        <div class="tw-label">${l.label}</div>
        <div class="tw-value ${l.className || ''}">${l.value}<span class="cursor"></span></div>
      </div>
    `).join('');

    requestAnimationFrame(() => {
      setTimeout(() => img.classList.add('visible'), 100);
    });

    const typewriterLines = panel.querySelectorAll('.typewriter-line');
    typewriterLines.forEach((line, i) => {
      setTimeout(() => line.classList.add('visible'), 400 + i * 400);
    });

  } catch (e) {
    panel.innerHTML = '<p style="color:var(--muted)">成员不存在</p>';
  }
})();
