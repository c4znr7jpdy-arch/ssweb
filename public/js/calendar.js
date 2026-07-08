let currentDate = new Date();
let events = [];

const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];

async function loadEvents() {
  const y = currentDate.getFullYear();
  const m = String(currentDate.getMonth() + 1).padStart(2, '0');
  const res = await fetch(`/api/events?month=${y}-${m}`);
  events = await res.json();
  renderCalendar();
  renderDayEvents(new Date());
}

function renderCalendar() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const today = new Date();

  document.getElementById('monthTitle').textContent = `${y}年 ${monthNames[m]}`;

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();

  let html = ['日','一','二','三','四','五','六'].map(d =>
    `<div class="cal-header">${d}</div>`
  ).join('');

  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev - i}</div></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = events.filter(e => e.event_date === dateStr);
    const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

    html += `
      <div class="cal-day ${isToday ? 'today' : ''}" onclick="selectDay('${dateStr}')">
        <div class="cal-day-num">${d}</div>
        <div class="event-dots">
          ${dayEvents.map(e => `<div class="event-dot ${e.type}"></div>`).join('')}
        </div>
      </div>`;
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  }

  document.getElementById('calendarGrid').innerHTML = html;
}

function renderDayEvents(dateStr) {
  const dayEvents = events.filter(e => e.event_date === dateStr);
  const d = new Date(dateStr);
  const dayOfWeek = dayNames[d.getDay()];
  document.getElementById('sideTitle').textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${dayOfWeek}`;

  if (dayEvents.length === 0) {
    document.getElementById('eventList').innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">暂无活动</p>';
    return;
  }

  document.getElementById('eventList').innerHTML = dayEvents.map(e => `
    <div class="event-card">
      <div class="event-time">${e.start_time || '待定'} ${e.end_time ? '- ' + e.end_time : ''}</div>
      <div class="event-title">${e.title}</div>
      <div class="event-meta">${e.leader ? '组织人：' + e.leader : ''} ${e.location ? '· ' + e.location : ''}</div>
      <div class="event-status ${e.status}">${{upcoming:'未开始',ongoing:'进行中',ended:'已结束',cancelled:'已取消'}[e.status] || e.status}</div>
    </div>
  `).join('');
}

window.selectDay = (dateStr) => {
  renderDayEvents(dateStr);
};

document.getElementById('prevMonth').onclick = () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  loadEvents();
};

document.getElementById('nextMonth').onclick = () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  loadEvents();
};

loadEvents();
