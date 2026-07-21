let members = [];
let events = [];
let activeRosterEventId = null;
let activeRosterMembers = [];
const requestedTab = new URLSearchParams(location.search).get('tab');

function activateAdminTab(tabName) {
  const name = ['members', 'events', 'contributions'].includes(tabName) ? tabName : 'members';
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === name);
  });
  document.querySelectorAll('.admin-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${name}`);
  });
}

function showAdminPanel() {
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  activateAdminTab(requestedTab);
  loadAll();
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

async function login() {
  const username = document.getElementById('usernameInput').value.trim();
  const pwd = document.getElementById('passwordInput').value;
  const res = await fetch('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password: pwd })
  });
  if (res.ok) {
    const data = await res.json();
    if (data.mustChangePassword) {
      location.href = '/login.html?next=/admin.html%3Ftab%3Devents';
      return;
    }
    showAdminPanel();
  } else {
    alert('密码错误');
  }
}

(async () => {
  const res = await fetch('/api/admin/auth/check');
  const { isAdmin, mustChangePassword } = await res.json();
  if (mustChangePassword) {
    location.href = '/login.html?next=/admin.html%3Ftab%3Devents';
    return;
  }
  if (isAdmin) {
    showAdminPanel();
  }
})();

document.querySelector('.admin-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.admin-tab');
  if (!tab) return;
  activateAdminTab(tab.dataset.tab);
});

async function loadAll() {
  const [mRes, eRes, cRes] = await Promise.all([
    fetch('/api/members'),
    fetch('/api/events'),
    fetch('/api/contributions/records')
  ]);
  members = await mRes.json();
  events = await eRes.json();
  const contributions = await cRes.json();
  renderMemberTable(members);
  renderEventTable(events);
  renderContributionTable(contributions, members);
}

function renderMemberTable(list) {
  document.getElementById('memberTableBody').innerHTML = list.map(m => `
    <tr>
      <td>${esc(m.id)}</td>
      <td>${esc(m.nickname)}</td>
      <td>${esc(m.role)}</td>
      <td>${esc(m.tags || '-')}</td>
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
      <td>${esc(e.event_date)}</td>
      <td>${esc(e.title)}</td>
      <td>${esc(e.type)}</td>
      <td>${esc(e.status)}</td>
      <td class="action-btns">
        <a class="action-link" href="/event.html?id=${encodeURIComponent(e.id)}" target="_blank" rel="noopener">报名页</a>
        <button onclick="manageEventRoster(${e.id})" title="添加或删除报名成员">名单管理</button>
        <button onclick="copyKdocsScript(${e.id})" title="复制金山文档同步脚本">金山同步</button>
        <button onclick="editEvent(${e.id})" title="编辑">✎</button>
        <button class="delete-btn" onclick="deleteEvent(${e.id})" title="删除">✕</button>
      </td>
    </tr>
  `).join('');
}

function kdocsSyncMessage(sync) {
  if (sync?.triggered) return { text: '名单已保存，并已同步到金山文档。', type: 'success' };
  const reason = sync?.reason || '';
  if (reason === 'event_not_managed') {
    return { text: '名单已保存；该活动不是当前金山文档同步活动。', type: 'warning' };
  }
  if (reason === 'request_failed') {
    return { text: '名单已保存，但金山文档同步失败，请稍后重试。', type: 'warning' };
  }
  if (reason === 'disabled' || reason === 'not_configured') {
    return { text: '名单已保存，但金山文档同步当前未启用。', type: 'warning' };
  }
  return { text: '', type: '' };
}

function getEventRosterContainer() {
  let box = document.getElementById('eventRosterManager');
  if (box) return box;

  const panel = document.getElementById('panel-events');
  const table = panel?.querySelector('.admin-table');
  if (!panel || !table) {
    throw new Error('活动名单管理区域加载失败，请刷新页面后重试');
  }

  box = document.createElement('div');
  box.id = 'eventRosterManager';
  box.className = 'event-roster-manager';
  panel.insertBefore(box, table);
  return box;
}

function renderEventRoster(data, sync = null) {
  const box = getEventRosterContainer();
  const syncStatus = kdocsSyncMessage(sync);
  const roster = Array.isArray(data.members) ? data.members : [];
  activeRosterEventId = data.event.id;
  activeRosterMembers = roster;
  box.style.display = 'block';
  box.innerHTML = `
    <div class="roster-manager-header">
      <h4>【${esc(data.event.title)}】报名名单（${esc(data.joinedCount)}/${esc(data.capacity)}）</h4>
      <button class="btn btn-ghost" onclick="closeEventRoster()">关闭</button>
    </div>
    <div class="roster-add-row">
      <input id="roster-member-name" list="admin-member-suggestions" maxlength="32"
        placeholder="输入站内成员昵称或访客名称"
        onkeydown="if(event.key==='Enter')addEventRosterMember()">
      <datalist id="admin-member-suggestions">
        ${members.map(member => `<option value="${esc(member.nickname)}"></option>`).join('')}
      </datalist>
      <button class="btn btn-primary" id="roster-add-btn" onclick="addEventRosterMember()"
        ${data.remaining <= 0 ? 'disabled' : ''}>+ 添加报名</button>
    </div>
    <div id="roster-status" class="roster-status ${syncStatus.type}">${esc(syncStatus.text)}</div>
    <div class="roster-member-list">
      ${roster.length ? roster.map((item, index) => `
        <div class="roster-member-item">
          <div>
            <strong>${index + 1}. ${esc(item.nickname)}</strong>
            <span class="roster-member-meta">${esc(item.role || (item.source === 'guest' ? '访客报名' : '成员'))}</span>
          </div>
          <button class="delete-btn" onclick="removeEventRosterMember('${item.source === 'guest' ? 'guest' : 'member'}', ${Number(item.signup_id)})">删除</button>
        </div>
      `).join('') : '<div class="roster-empty">暂无报名成员</div>'}
    </div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function manageEventRoster(eventId) {
  try {
    const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/roster`, {
      credentials: 'include'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '读取活动名单失败');
    renderEventRoster(data);
  } catch (error) {
    alert(error.message || '读取活动名单失败');
  }
}

function closeEventRoster() {
  activeRosterEventId = null;
  activeRosterMembers = [];
  const box = getEventRosterContainer();
  box.style.display = 'none';
  box.innerHTML = '';
}

async function addEventRosterMember() {
  if (!activeRosterEventId) return;
  const input = document.getElementById('roster-member-name');
  const button = document.getElementById('roster-add-btn');
  const name = input.value.trim();
  if (!name) {
    alert('请输入报名成员名称。');
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch(`/api/admin/events/${encodeURIComponent(activeRosterEventId)}/roster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '添加报名成员失败');
    await loadAll();
    renderEventRoster(data, data.kdocsSync);
  } catch (error) {
    alert(error.message || '添加报名成员失败');
    button.disabled = false;
  }
}

async function removeEventRosterMember(source, signupId) {
  if (!activeRosterEventId) return;
  const signup = activeRosterMembers.find(item => (
    item.source === source && Number(item.signup_id) === Number(signupId)
  ));
  const nickname = signup?.nickname || '该成员';
  if (!confirm(`确定从报名名单中删除“${nickname}”吗？`)) return;
  try {
    const response = await fetch(
      `/api/admin/events/${encodeURIComponent(activeRosterEventId)}/roster/${encodeURIComponent(source)}/${encodeURIComponent(signupId)}`,
      { method: 'DELETE', credentials: 'include' }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '删除报名成员失败');
    await loadAll();
    renderEventRoster(data, data.kdocsSync);
  } catch (error) {
    alert(error.message || '删除报名成员失败');
  }
}

async function copyKdocsScript(eventId) {
  try {
    const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/kdocs-script`, {
      credentials: 'include'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '同步脚本生成失败');

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(data.script);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = data.script;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    alert(`【${data.event.title}】金山同步脚本已复制，请粘贴到该文档的 AirScript 中运行。`);
  } catch (error) {
    alert(error.message || '同步脚本生成失败');
  }
}

function renderContributionTable(list, memberList) {
  document.getElementById('contributionTableBody').innerHTML = list.map(c => {
    const m = memberList.find(x => x.id === c.member_id);
    return `
      <tr>
        <td>${esc(m ? m.nickname : c.member_id)}</td>
        <td style="color:var(--gold)">${esc(c.points)}</td>
        <td>${esc(c.type || '-')}</td>
        <td>${esc(c.reason || '-')}</td>
        <td>${esc(c.created_at)}</td>
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
        <div class="form-group"><label>昵称</label><input id="m-nickname" value="${esc(data?.nickname || '')}"></div>
        <div class="form-group"><label>职位</label><select id="m-role">
          ${['社主','副社','长老','核心成员','普通成员'].map(r => `<option ${data?.role===r?'selected':''}>${r}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>标签（逗号分隔）</label><input id="m-tags" value="${esc(data?.tags || '')}"></div>
        <div class="form-group"><label>签名</label><input id="m-signature" value="${esc(data?.signature || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>头像URL</label><input id="m-avatar" value="${esc(data?.avatar || '')}"></div>
        <div class="form-group"><label>封面URL</label><input id="m-cover" value="${esc(data?.cover || '')}"></div>
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
        <div class="form-group"><label>标题</label><input id="e-title" value="${esc(data?.title || '')}"></div>
        <div class="form-group"><label>类型</label><select id="e-type">
          ${['团建','副本','PVP','拍照','教学'].map(t => `<option ${data?.type===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>日期</label><input type="date" id="e-date" value="${esc(data?.event_date || '')}"></div>
        <div class="form-group"><label>开始时间</label><input type="time" id="e-start" value="${esc(data?.start_time || '')}"></div>
        <div class="form-group"><label>结束时间</label><input type="time" id="e-end" value="${esc(data?.end_time || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>组织人</label><input id="e-leader" value="${esc(data?.leader || '')}"></div>
        <div class="form-group"><label>地点</label><input id="e-location" value="${esc(data?.location || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>描述</label><textarea id="e-desc">${esc(data?.description || '')}</textarea></div>
      </div>
      <button class="btn btn-primary" id="event-save-btn" onclick="saveEvent(${data?.id || 'null'})">保存</button>
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

  if (!body.title.trim() || !body.event_date || !body.start_time) {
    alert('请填写活动标题、活动日期和开始时间。');
    return;
  }

  const startDate = new Date(`${body.event_date}T${body.start_time}:00`);
  if (Number.isNaN(startDate.getTime())) {
    alert('活动开始日期或时间格式不正确。');
    return;
  }

  const startLabel = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(startDate);
  const confirmed = confirm(
    `请二次确认活动信息：\n\n` +
    `活动：${body.title.trim()}\n` +
    `开始时间：${startLabel}\n\n` +
    `系统将在活动开始前 10 分钟向已配置群聊发送提醒卡片。\n` +
    `确认保存吗？`
  );
  if (!confirmed) return;

  const url = id ? `/api/admin/events/${id}` : '/api/admin/events';
  const method = id ? 'PUT' : 'POST';
  const saveButton = document.getElementById('event-save-btn');
  if (saveButton) saveButton.disabled = true;
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '保存活动失败');
    document.getElementById('eventForm').style.display = 'none';
    await loadAll();
  } catch (error) {
    alert(error.message || '保存活动失败');
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
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
          ${members.map(m => `<option value="${esc(m.id)}">${esc(m.nickname)}</option>`).join('')}
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
