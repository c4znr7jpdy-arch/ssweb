let allMembers = [];
let currentRole = '';

const grid = document.getElementById('membersGrid');
const filterBar = document.getElementById('filterBar');

async function loadMembers() {
  const res = await fetch('/api/members');
  allMembers = await res.json();
  renderMembers();
}

function renderMembers() {
  const filtered = currentRole
    ? allMembers.filter(m => m.role === currentRole)
    : allMembers;

  grid.innerHTML = filtered.map(m => `
    <div class="member-card" onclick="location.href='/member.html?id=${m.id}'">
      <img class="member-avatar" src="${m.avatar || '/images/members/default.jpg'}" alt="${m.nickname}">
      <div class="member-info">
        <div class="member-name">${m.nickname}</div>
        <div class="member-role">${m.role}</div>
        ${m.tags ? `<div class="member-tags">${m.tags.split(',').map(t => `<span class="member-tag">${t.trim()}</span>`).join('')}</div>` : ''}
        ${m.signature ? `<div class="member-signature">${m.signature}</div>` : ''}
      </div>
    </div>
  `).join('');
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
