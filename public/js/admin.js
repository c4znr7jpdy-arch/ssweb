let members = [];

async function login() {
  const pwd = document.getElementById('passwordInput').value;
  const res = await fetch('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pwd })
  });
  if (res.ok) {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAll();
  } else {
    alert('密码错误');
  }
}

(async () => {
  const res = await fetch('/api/admin/auth/check');
  const { isAdmin } = await res.json();
  if (isAdmin) {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAll();
  }
})();

document.querySelector('.admin-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.admin-tab');
  if (!tab) return;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
});

async function loadAll() {
  const [mRes, eRes, cRes] = await Promise.all([
    fetch('/api/members'),
    fetch('/api/events'),
    fetch('/api/contributions/records')
  ]);
  members = await mRes.json();
  const events = await eRes.json();
  const contributions = await cRes.json();
  renderMemberTable(members);
  renderEventTable(events);
  renderContributionTable(contributions, members);
}

function renderMemberTable(list) {
  document.getElementById('memberTableBody').innerHTML = list.map(m => `
    <tr>
      <td>${m.id}</td>
      <td>${m.nickname}</td>
      <td>${m.role}</td>
      <td>${m.tags || '-'}</td>
      <td class="action-btns">
        <button onclick="editMember(${m.id})" title="编辑">✎</button>
        <button class="delete-btn" onclick="deleteMember(${m.id})" title="删除">✕</button>
      </td>
    </tr>
  `).join('');
}

function renderEventTable(list) {
  document.getElementById('eventTableBody').innerHTML = list.map(e => `
    <tr>
      <td>${e.event_date}</td>
      <td>${e.title}</td>
      <td>${e.type}</td>
      <td>${e.status}</td>
      <td class="action-btns">
        <button onclick="editEvent(${e.id})" title="编辑">✎</button>
        <button class="delete-btn" onclick="deleteEvent(${e.id})" title="删除">✕</button>
      </td>
    </tr>
  `).join('');
}

function renderContributionTable(list, memberList) {
  document.getElementById('contributionTableBody').innerHTML = list.map(c => {
    const m = memberList.find(x => x.id === c.member_id);
    return `
      <tr>
        <td>${m ? m.nickname : c.member_id}</td>
        <td style="color:var(--gold)">${c.points}</td>
        <td>${c.type || '-'}</td>
        <td>${c.reason || '-'}</td>
        <td>${c.created_at}</td>
        <td class="action-btns">
          <button class="delete-btn" onclick="deleteContribution(${c.id})" title="删除">✕</button>
        </td>
      </tr>`;
  }).join('');
}

function showMemberForm(data = null) {
  const f = document.getElementById('memberForm');
  f.style.display = 'block';
  f.innerHTML = `
    <div class="admin-form">
      <div class="form-row">
        <div class="form-group"><label>昵称</label><input id="m-nickname" value="${data?.nickname || ''}"></div>
        <div class="form-group"><label>职位</label><select id="m-role">
          ${['社主','副社','管理','核心成员','普通成员'].map(r => `<option ${data?.role===r?'selected':''}>${r}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>标签（逗号分隔）</label><input id="m-tags" value="${data?.tags || ''}"></div>
        <div class="form-group"><label>签名</label><input id="m-signature" value="${data?.signature || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>头像URL</label><input id="m-avatar" value="${data?.avatar || ''}"></div>
        <div class="form-group"><label>封面URL</label><input id="m-cover" value="${data?.cover || ''}"></div>
      </div>
      <button class="btn btn-primary" onclick="saveMember(${data?.id || 'null'})">保存</button>
      <button class="btn btn-ghost" onclick="document.getElementById('memberForm').style.display='none'">取消</button>
    </div>`;
}

async function saveMember(id) {
  const body = {
    nickname: document.getElementById('m-nickname').value,
    role: document.getElementById('m-role').value,
    tags: document.getElementById('m-tags').value,
    signature: document.getElementById('m-signature').value,
    avatar: document.getElementById('m-avatar').value,
    cover: document.getElementById('m-cover').value
  };
  const url = id ? `/api/admin/members/${id}` : '/api/admin/members';
  const method = id ? 'PUT' : 'POST';
  await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  document.getElementById('memberForm').style.display = 'none';
  loadAll();
}

function editMember(id) {
  const m = members.find(x => x.id === id);
  if (m) showMemberForm(m);
}

async function deleteMember(id) {
  if (!confirm('确定删除此成员？')) return;
  await fetch(`/api/admin/members/${id}`, { method: 'DELETE' });
  loadAll();
}

function showEventForm(data = null) {
  const f = document.getElementById('eventForm');
  f.style.display = 'block';
  f.innerHTML = `
    <div class="admin-form">
      <div class="form-row">
        <div class="form-group"><label>标题</label><input id="e-title" value="${data?.title || ''}"></div>
        <div class="form-group"><label>类型</label><select id="e-type">
          ${['团建','副本','PVP','拍照','教学'].map(t => `<option ${data?.type===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>日期</label><input type="date" id="e-date" value="${data?.event_date || ''}"></div>
        <div class="form-group"><label>开始时间</label><input type="time" id="e-start" value="${data?.start_time || ''}"></div>
        <div class="form-group"><label>结束时间</label><input type="time" id="e-end" value="${data?.end_time || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>组织人</label><input id="e-leader" value="${data?.leader || ''}"></div>
        <div class="form-group"><label>地点</label><input id="e-location" value="${data?.location || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>描述</label><textarea id="e-desc">${data?.description || ''}</textarea></div>
      </div>
      <button class="btn btn-primary" onclick="saveEvent(${data?.id || 'null'})">保存</button>
      <button class="btn btn-ghost" onclick="document.getElementById('eventForm').style.display='none'">取消</button>
    </div>`;
}

async function saveEvent(id) {
  const body = {
    title: document.getElementById('e-title').value,
    type: document.getElementById('e-type').value,
    event_date: document.getElementById('e-date').value,
    start_time: document.getElementById('e-start').value,
    end_time: document.getElementById('e-end').value,
    leader: document.getElementById('e-leader').value,
    location: document.getElementById('e-location').value,
    description: document.getElementById('e-desc').value
  };
  const url = id ? `/api/admin/events/${id}` : '/api/admin/events';
  const method = id ? 'PUT' : 'POST';
  await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  document.getElementById('eventForm').style.display = 'none';
  loadAll();
}

async function deleteEvent(id) {
  if (!confirm('确定删除此活动？')) return;
  await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
  loadAll();
}

function showContributionForm() {
  const f = document.getElementById('contributionForm');
  f.style.display = 'block';
  f.innerHTML = `
    <div class="admin-form">
      <div class="form-row">
        <div class="form-group"><label>成员</label><select id="c-member">
          ${members.map(m => `<option value="${m.id}">${m.nickname}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>分值</label><input type="number" id="c-points" value="10"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>类型</label><select id="c-type">
          ${['参加活动','组织活动','新人教学','攻略投稿','百业管理','特殊贡献'].map(t => `<option>${t}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>原因</label><input id="c-reason"></div>
      </div>
      <button class="btn btn-primary" onclick="saveContribution()">保存</button>
      <button class="btn btn-ghost" onclick="document.getElementById('contributionForm').style.display='none'">取消</button>
    </div>`;
}

async function saveContribution() {
  const body = {
    member_id: parseInt(document.getElementById('c-member').value),
    points: parseInt(document.getElementById('c-points').value),
    type: document.getElementById('c-type').value,
    reason: document.getElementById('c-reason').value
  };
  await fetch('/api/admin/contributions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  document.getElementById('contributionForm').style.display = 'none';
  loadAll();
}

async function deleteContribution(id) {
  if (!confirm('确定删除此记录？')) return;
  await fetch(`/api/admin/contributions/${id}`, { method: 'DELETE' });
  loadAll();
}
