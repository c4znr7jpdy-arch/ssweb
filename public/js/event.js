const params = new URLSearchParams(location.search);
const eventId = Number(params.get('id'));
const capacityDefault = 10;

const statusLabels = {
  upcoming: '报名中',
  ongoing: '进行中',
  ended: '已结束',
  cancelled: '已取消'
};

let currentEvent = null;

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function safeMediaUrl(value) {
  const url = String(value || '').trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return '';
}

function formatDateTime(event) {
  const date = new Date(`${event.event_date}T00:00:00`);
  const dateText = Number.isNaN(date.getTime())
    ? event.event_date
    : new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(date);
  const timeText = [event.start_time, event.end_time].filter(Boolean).join(' - ');
  return `${dateText}${timeText ? ` · ${timeText}` : ''}`;
}

function renderMembers(members) {
  const grid = document.getElementById('memberGrid');
  grid.replaceChildren();

  if (!members.length) {
    const empty = document.createElement('div');
    empty.className = 'roster-empty';
    empty.textContent = '还没有人报名，成为第一位报名成员吧。';
    grid.appendChild(empty);
    return;
  }

  members.forEach(member => {
    const item = document.createElement('article');
    item.className = 'member-item';

    const avatar = document.createElement('div');
    avatar.className = 'member-avatar';
    const avatarUrl = safeMediaUrl(member.avatar);
    if (avatarUrl) {
      const image = document.createElement('img');
      image.src = avatarUrl;
      image.alt = '';
      image.loading = 'lazy';
      avatar.appendChild(image);
    } else {
      avatar.textContent = String(member.nickname || '侠').slice(0, 1);
    }

    const copy = document.createElement('div');
    copy.className = 'member-copy';
    const name = document.createElement('strong');
    name.textContent = member.nickname || '未命名成员';
    copy.append(name);

    item.append(avatar, copy);
    grid.appendChild(item);
  });
}

function renderEvent(event) {
  currentEvent = event;
  const members = Array.isArray(event.members) ? event.members : [];
  const capacity = Number(event.capacity) || capacityDefault;
  const joined = members.length;

  document.title = `${event.title}｜活动报名`;
  setText('eventTitle', event.title || '活动报名');
  setText('eventDateTime', formatDateTime(event));
  setText('joinedCount', joined);
  setText('capacityCount', capacity);
  setText('rosterCount', `${joined} 人`);

  const status = document.getElementById('eventStatus');
  status.textContent = event.signup_allowed ? '报名中' : (statusLabels[event.status] || '报名关闭');
  status.classList.toggle('closed', !event.signup_allowed);

  const percent = Math.min(100, Math.round((joined / capacity) * 100));
  document.getElementById('capacityBar').style.width = `${percent}%`;
  document.getElementById('eventId').value = event.id;

  const button = document.getElementById('signupButton');
  button.disabled = !event.signup_allowed;

  renderMembers(members);
}

function showPageError(message) {
  document.getElementById('eventContent').hidden = true;
  document.getElementById('pageError').hidden = false;
  setText('pageErrorMessage', message || '活动不存在或已经被删除。');
}

async function loadIdentity() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (!response.ok) return;
    const data = await response.json();
    const detectedUsername = data.user?.username || '';
    const input = document.getElementById('signupName');
    if (detectedUsername && !input.value) input.value = detectedUsername;
  } catch {
    // 游客可以直接手动输入名称。
  }
}

async function loadEvent() {
  if (!Number.isInteger(eventId) || eventId <= 0) {
    showPageError('活动链接缺少有效的活动 ID。');
    return;
  }

  try {
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '活动读取失败');
    document.getElementById('pageError').hidden = true;
    document.getElementById('eventContent').hidden = false;
    renderEvent(data);
  } catch (error) {
    showPageError(error.message);
  }
}

async function submitSignup(event) {
  event.preventDefault();
  const input = document.getElementById('signupName');
  const message = document.getElementById('signupMessage');
  const button = document.getElementById('signupButton');
  const name = input.value.trim();

  message.className = 'signup-message';
  if (!name) {
    message.classList.add('error');
    message.textContent = '请输入报名名称。';
    input.focus();
    return;
  }

  button.disabled = true;
  message.textContent = '正在加入活动名单……';

  try {
    const response = await fetch('/api/events/raid-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ eventId, name })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '报名失败');

    message.classList.add('success');
    message.textContent = data.message || '报名成功';
    await loadEvent();
  } catch (error) {
    message.classList.add('error');
    message.textContent = error.message;
    button.disabled = !currentEvent?.signup_allowed;
  }
}

document.getElementById('eventSignupForm').addEventListener('submit', submitSignup);

Promise.all([loadIdentity(), loadEvent()]);
