let currentDate = new Date();
let selectedDate = toDateString(new Date());
let events = [];

const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const weekHeaders = ['一', '二', '三', '四', '五', '六', '日'];
const statusLabels = {
  upcoming: '未开始',
  ongoing: '进行中',
  ended: '已结束',
  cancelled: '已取消'
};

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function makeEl(tag, className, value) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (value !== undefined) el.textContent = value;
  return el;
}

async function loadEvents({ keepSelection = true } = {}) {
  const y = currentDate.getFullYear();
  const m = String(currentDate.getMonth() + 1).padStart(2, '0');
  const res = await fetch(`/api/events?month=${y}-${m}`);
  events = await res.json();
  renderCalendar();
  renderDayEvents(keepSelection ? selectedDate : toDateString(new Date()));
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = toDateString(new Date());
  const calendarGrid = document.getElementById('calendarGrid');

  document.getElementById('monthTitle').textContent = `${year} ${monthNames[month]}`;
  calendarGrid.replaceChildren();

  weekHeaders.forEach((label, columnIndex) => {
    const header = makeEl('div', 'cal-header', label);
    if (columnIndex >= 5) header.classList.add('weekend');
    calendarGrid.appendChild(header);
  });

  // 中国日历以周一为每周第一天：周一=0，周日=6。
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  for (let index = firstDay - 1; index >= 0; index--) {
    const day = makeEl('div', 'cal-day other-month');
    const columnIndex = firstDay - 1 - index;
    if (columnIndex >= 5) day.classList.add('weekend');
    day.appendChild(makeEl('div', 'cal-day-num', daysInPrev - index));
    calendarGrid.appendChild(day);
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const dayEvents = events.filter(event => event.event_date === dateStr);
    const day = makeEl('button', 'cal-day');
    day.type = 'button';
    const columnIndex = (firstDay + dayNumber - 1) % 7;
    if (columnIndex >= 5) day.classList.add('weekend');
    if (dateStr === today) day.classList.add('today');
    if (dateStr === selectedDate) day.classList.add('selected');
    day.addEventListener('click', () => renderDayEvents(dateStr));
    day.appendChild(makeEl('div', 'cal-day-num', dayNumber));

    const eventBox = makeEl('div', 'day-events');
    dayEvents.slice(0, 3).forEach(event => {
      const label = `${event.start_time || '--'} ${event.title || '--'}${event.member_count ? ` · ${event.member_count}人` : ''}`;
      eventBox.appendChild(makeEl('span', 'mini-event', label));
    });
    if (dayEvents.length > 3) {
      eventBox.appendChild(makeEl('span', 'mini-event', `+${dayEvents.length - 3} 个活动`));
    }
    day.appendChild(eventBox);
    calendarGrid.appendChild(day);
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let index = 1; index <= remaining; index++) {
    const day = makeEl('div', 'cal-day other-month');
    const columnIndex = (firstDay + daysInMonth + index - 1) % 7;
    if (columnIndex >= 5) day.classList.add('weekend');
    day.appendChild(makeEl('div', 'cal-day-num', index));
    calendarGrid.appendChild(day);
  }
}

async function fetchEventDetail(eventId) {
  const res = await fetch(`/api/events/${eventId}`);
  if (!res.ok) return null;
  return res.json();
}

async function renderDayEvents(dateValue) {
  selectedDate = dateValue;
  const dayEvents = events.filter(event => event.event_date === dateValue);
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const eventList = document.getElementById('eventList');

  document.getElementById('sideTitle').textContent = `${month}月${day}日 ${dayNames[date.getDay()]}`;
  eventList.replaceChildren();
  renderCalendar();

  if (!dayEvents.length) {
    eventList.appendChild(makeEl('div', 'empty-state', '这天暂时没有活动。'));
    return;
  }

  const details = await Promise.all(dayEvents.map(event => fetchEventDetail(event.id)));
  details.filter(Boolean).forEach(event => {
    eventList.appendChild(renderEventCard(event));
  });
}

function renderEventCard(event) {
  const card = makeEl('article', 'event-card');
  const head = makeEl('div', 'event-card-head');
  const info = makeEl('div');
  info.appendChild(makeEl('div', 'event-time', `${event.start_time || '待定'}${event.end_time ? ` - ${event.end_time}` : ''}`));
  info.appendChild(makeEl('div', 'event-title', event.title || '--'));
  info.appendChild(makeEl('div', 'event-meta', [
    event.leader ? `组织：${event.leader}` : '',
    event.location ? `地点：${event.location}` : '',
    statusLabels[event.status] || event.status || ''
  ].filter(Boolean).join(' · ')));

  head.appendChild(info);
  head.appendChild(makeEl('div', 'member-count', `${event.members.length}/${event.capacity || 10}`));
  card.appendChild(head);

  const roster = makeEl('div', 'roster');
  if (event.members.length) {
    event.members.forEach(member => {
      roster.appendChild(makeEl('span', '', member.nickname));
    });
  } else {
    roster.appendChild(makeEl('span', '', '暂无报名'));
  }
  card.appendChild(roster);

  const detailLink = makeEl('a', 'event-detail-link', '打开活动报名页');
  detailLink.href = `/event.html?id=${encodeURIComponent(event.id)}`;
  card.appendChild(detailLink);
  return card;
}

document.getElementById('prevMonth').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  loadEvents({ keepSelection: false });
});

document.getElementById('nextMonth').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  loadEvents({ keepSelection: false });
});

loadEvents();
