let allMembers = [];
let currentRole = '';

const grid = document.getElementById('membersGrid');
const filterBar = document.getElementById('filterBar');
const featuredFallbacks = new Map([
  ['1', '/images/home-banner.webp'],
  ['2', '/images/banner2.webp'],
  ['3', '/images/banner3.webp'],
  ['4', '/images/banner4.webp'],
  ['5', '/images/banner5.webp']
]);
const blankMemberImage = '/images/member-blank.svg';

function safeUrl(value, fallback) {
  const url = String(value || '').trim();
  if (!url) return fallback;
  if (url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
  return fallback;
}

function addText(parent, className, value) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = value;
  parent.appendChild(el);
  return el;
}

async function loadMembers() {
  const res = await fetch('/api/members');
  allMembers = await res.json();
  renderMembers();
}

function renderMembers() {
  const filtered = currentRole
    ? allMembers.filter(m => m.role === currentRole)
    : allMembers;

  grid.replaceChildren();

  filtered.forEach((m) => {
    const fallback = featuredFallbacks.get(String(m.id)) || blankMemberImage;
    const card = document.createElement('article');
    card.className = 'member-card';
    card.tabIndex = 0;
    card.addEventListener('click', () => {
      location.href = `/member.html?id=${encodeURIComponent(m.id)}&from=members`;
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') card.click();
    });

    const img = document.createElement('img');
    img.className = 'member-avatar';
    img.src = safeUrl(m.avatar || m.cover, fallback);
    img.alt = m.nickname || '成员';
    img.loading = 'lazy';
    card.appendChild(img);

    const info = document.createElement('div');
    info.className = 'member-info';
    addText(info, 'member-name', m.nickname || '--');
    addText(info, 'member-role', m.role || '成员');

    if (m.tags) {
      const tags = document.createElement('div');
      tags.className = 'member-tags';
      String(m.tags).split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'member-tag';
        tagEl.textContent = tag;
        tags.appendChild(tagEl);
      });
      info.appendChild(tags);
    }

    if (m.signature) addText(info, 'member-signature', m.signature);

    card.appendChild(info);
    grid.appendChild(card);
  });
}

filterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentRole = btn.dataset.role;
  renderMembers();
});

loadMembers();
