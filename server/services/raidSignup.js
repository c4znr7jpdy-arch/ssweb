const db = require('../db');

const MAX_SIGNUP_COUNT = 10;
const DEFAULT_REMINDER_MINUTES = 10;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toLocalDateTime(event) {
  const date = cleanText(event.event_date);
  if (!date) return null;
  const time = cleanText(event.end_time || event.start_time) || '23:59';
  return new Date(`${date}T${time.length === 5 ? time : '23:59'}:00`);
}

function isEventExpired(event, now = new Date()) {
  const status = cleanText(event.status);
  if (status === 'ended' || status === 'cancelled') return true;

  const eventTime = toLocalDateTime(event);
  if (!eventTime || Number.isNaN(eventTime.getTime())) return false;
  return eventTime.getTime() < now.getTime();
}

function parseChinaEventStart(event) {
  const date = cleanText(event && event.event_date);
  const time = cleanText(event && event.start_time);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch.map(Number);
  const [, hour, minute] = timeMatch.map(Number);
  if (hour > 23 || minute > 59) return null;

  // 网站活动时间统一按中国标准时间（UTC+8）解释，不依赖服务器所在时区。
  const timestamp = Date.UTC(year, month - 1, day, hour - 8, minute, 0);
  const start = new Date(timestamp);
  if (Number.isNaN(start.getTime())) return null;

  // 将时间移回 UTC+8 后核对年月日，拒绝 2 月 30 日等自动滚动日期。
  const chinaWallClock = new Date(timestamp + 8 * 60 * 60 * 1000);
  if (
    chinaWallClock.getUTCFullYear() !== year ||
    chinaWallClock.getUTCMonth() + 1 !== month ||
    chinaWallClock.getUTCDate() !== day ||
    chinaWallClock.getUTCHours() !== hour ||
    chinaWallClock.getUTCMinutes() !== minute
  ) return null;
  return start;
}

function currentChinaWeekMonday(now = new Date()) {
  const chinaWallClock = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const daysSinceMonday = (chinaWallClock.getUTCDay() + 6) % 7;
  chinaWallClock.setUTCHours(0, 0, 0, 0);
  chinaWallClock.setUTCDate(chinaWallClock.getUTCDate() - daysSinceMonday);
  const year = chinaWallClock.getUTCFullYear();
  const month = String(chinaWallClock.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaWallClock.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeReminderMinutes(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_REMINDER_MINUTES;
  return Math.max(1, Math.min(parsed, 120));
}

function listDueStartReminders(reminderMinutes = DEFAULT_REMINDER_MINUTES, now = new Date()) {
  const minutes = normalizeReminderMinutes(reminderMinutes);
  const windowMs = minutes * 60 * 1000;
  const rows = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_members em WHERE em.event_id = e.id) +
      (SELECT COUNT(*) FROM event_guest_signups eg WHERE eg.event_id = e.id) AS member_count
    FROM events e
    LEFT JOIN event_start_reminders r
      ON r.event_id = e.id AND r.reminder_minutes = ?
    WHERE e.start_time IS NOT NULL
      AND TRIM(e.start_time) <> ''
      AND COALESCE(e.status, 'upcoming') NOT IN ('ended', 'cancelled')
      AND r.event_id IS NULL
    ORDER BY e.event_date ASC, e.start_time ASC, e.id ASC
  `).all(minutes);

  return rows.flatMap(event => {
    const start = parseChinaEventStart(event);
    if (!start) return [];
    const remainingMs = start.getTime() - now.getTime();
    if (remainingMs <= 0 || remainingMs > windowMs) return [];
    return [{
      ...event,
      reminder_minutes: minutes,
      minutes_remaining: Math.max(1, Math.ceil(remainingMs / 60000)),
      starts_at: start.toISOString(),
      capacity: MAX_SIGNUP_COUNT
    }];
  });
}

function markStartReminderSent(eventId, reminderMinutes = DEFAULT_REMINDER_MINUTES) {
  const id = Number.parseInt(eventId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw Object.assign(new Error('活动 ID 无效'), { statusCode: 400 });
  }
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(id);
  if (!event) {
    throw Object.assign(new Error('活动不存在'), { statusCode: 404 });
  }
  const minutes = normalizeReminderMinutes(reminderMinutes);
  const result = db.prepare(`
    INSERT OR IGNORE INTO event_start_reminders (event_id, reminder_minutes)
    VALUES (?, ?)
  `).run(id, minutes);
  return { eventId: id, reminderMinutes: minutes, recorded: result.changes > 0 };
}

function listPendingCreationAnnouncements() {
  const rows = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_members em WHERE em.event_id = e.id) +
      (SELECT COUNT(*) FROM event_guest_signups eg WHERE eg.event_id = e.id) AS member_count
    FROM events e
    LEFT JOIN event_creation_announcements a ON a.event_id = e.id
    WHERE a.event_id IS NULL
      AND COALESCE(e.status, 'upcoming') NOT IN ('ended', 'cancelled')
    ORDER BY e.id ASC
  `).all();

  return rows
    .filter(event => !isEventExpired(event))
    .map(event => ({ ...event, capacity: MAX_SIGNUP_COUNT }));
}

function markCreationAnnouncementSent(eventId) {
  const id = Number.parseInt(eventId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw Object.assign(new Error('活动 ID 无效'), { statusCode: 400 });
  }
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(id);
  if (!event) {
    throw Object.assign(new Error('活动不存在'), { statusCode: 404 });
  }
  const result = db.prepare(`
    INSERT OR IGNORE INTO event_creation_announcements (event_id)
    VALUES (?)
  `).run(id);
  return { eventId: id, recorded: result.changes > 0 };
}

// 保留此导出以兼容现有调用。只要活动存在于网站数据库中，就允许参与公开报名。
function isAdminCreatedEvent(event) {
  return Boolean(event && event.id);
}

function findMemberByName(name) {
  const cleaned = cleanText(name);
  if (!cleaned) return null;

  const exact = db.prepare(`
    SELECT m.id, m.nickname, m.role, m.avatar, u.username
    FROM members m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.nickname = ? OR u.username = ?
    LIMIT 1
  `).get(cleaned, cleaned);
  if (exact) return exact;

  const compact = cleaned.replace(/\s/g, '');
  const members = db.prepare(`
    SELECT m.id, m.nickname, m.role, m.avatar, u.username
    FROM members m
    LEFT JOIN users u ON u.id = m.user_id
    ORDER BY m.sort_order ASC, m.id ASC
  `).all();

  return members.find(member => {
    const nickname = cleanText(member.nickname).replace(/\s/g, '');
    const username = cleanText(member.username).replace(/\s/g, '');
    return nickname === compact || username.toLowerCase() === compact.toLowerCase();
  }) || null;
}

function getEventMemberCount(eventId) {
  const registered = db.prepare(`
    SELECT COUNT(*) AS count FROM event_members WHERE event_id = ?
  `).get(eventId).count;
  const guests = db.prepare(`
    SELECT COUNT(*) AS count FROM event_guest_signups WHERE event_id = ?
  `).get(eventId).count;
  return registered + guests;
}

function listMembers(eventId) {
  return db.prepare(`
    SELECT id, nickname, role, avatar, is_guest
    FROM (
      SELECT em.id AS signup_id, m.id, m.nickname, m.role, m.avatar, 0 AS is_guest, 0 AS source_order
      FROM event_members em
      JOIN members m ON em.member_id = m.id
      WHERE em.event_id = ?

      UNION ALL

      SELECT eg.id AS signup_id, NULL AS id, eg.signup_name AS nickname,
             '访客报名' AS role, NULL AS avatar, 1 AS is_guest, 1 AS source_order
      FROM event_guest_signups eg
      WHERE eg.event_id = ?
    )
    ORDER BY source_order ASC, signup_id ASC
  `).all(eventId, eventId);
}

function getAdminEventRoster(eventIdValue) {
  const eventId = Number.parseInt(eventIdValue, 10);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw Object.assign(new Error('活动 ID 无效'), { statusCode: 400 });
  }
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) {
    throw Object.assign(new Error('活动不存在'), { statusCode: 404 });
  }

  const members = db.prepare(`
    SELECT em.id AS signup_id, 'member' AS source, m.id AS member_id,
           m.nickname, m.role, m.avatar
    FROM event_members em
    JOIN members m ON m.id = em.member_id
    WHERE em.event_id = ?

    UNION ALL

    SELECT eg.id AS signup_id, 'guest' AS source, NULL AS member_id,
           eg.signup_name AS nickname, '访客报名' AS role, NULL AS avatar
    FROM event_guest_signups eg
    WHERE eg.event_id = ?

    ORDER BY source ASC, signup_id ASC
  `).all(eventId, eventId);

  return {
    event,
    members,
    joinedCount: members.length,
    capacity: MAX_SIGNUP_COUNT,
    remaining: Math.max(0, MAX_SIGNUP_COUNT - members.length)
  };
}

function addAdminEventSignup(eventIdValue, nameValue) {
  const roster = getAdminEventRoster(eventIdValue);
  const submittedName = cleanText(nameValue);
  if (!submittedName) {
    throw Object.assign(new Error('请输入报名成员名称'), { statusCode: 400 });
  }
  if (submittedName.length > 32) {
    throw Object.assign(new Error('报名成员名称不能超过 32 个字符'), { statusCode: 400 });
  }
  if (roster.members.some(item => cleanText(item.nickname).toLowerCase() === submittedName.toLowerCase())) {
    throw Object.assign(new Error(`${submittedName} 已在【${roster.event.title}】报名名单中`), {
      statusCode: 409
    });
  }
  if (roster.joinedCount >= MAX_SIGNUP_COUNT) {
    throw Object.assign(new Error(`活动报名人数已满（${MAX_SIGNUP_COUNT}/${MAX_SIGNUP_COUNT}）`), {
      statusCode: 409
    });
  }

  const member = findMemberByName(submittedName);
  if (member) {
    db.prepare('INSERT INTO event_members (event_id, member_id) VALUES (?, ?)')
      .run(roster.event.id, member.id);
  } else {
    db.prepare('INSERT INTO event_guest_signups (event_id, signup_name) VALUES (?, ?)')
      .run(roster.event.id, submittedName);
  }

  return {
    ...getAdminEventRoster(roster.event.id),
    added: true,
    member: {
      member_id: member ? member.id : null,
      nickname: member ? member.nickname : submittedName,
      role: member ? member.role : '访客报名',
      avatar: member ? member.avatar : null,
      source: member ? 'member' : 'guest'
    }
  };
}

function removeAdminEventSignup(eventIdValue, sourceValue, signupIdValue) {
  const roster = getAdminEventRoster(eventIdValue);
  const source = cleanText(sourceValue);
  const signupId = Number.parseInt(signupIdValue, 10);
  if (!['member', 'guest'].includes(source) || !Number.isFinite(signupId) || signupId <= 0) {
    throw Object.assign(new Error('报名记录参数无效'), { statusCode: 400 });
  }

  const table = source === 'member' ? 'event_members' : 'event_guest_signups';
  const result = db.prepare(`DELETE FROM ${table} WHERE id = ? AND event_id = ?`)
    .run(signupId, roster.event.id);
  if (!result.changes) {
    throw Object.assign(new Error('报名记录不存在或已被删除'), { statusCode: 404 });
  }

  return {
    ...getAdminEventRoster(roster.event.id),
    removed: true
  };
}

function findEventForSignup(payload = {}) {
  const eventId = Number(payload.eventId || payload.event_id || 0);
  if (eventId) {
    return db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) || null;
  }

  const title = cleanText(payload.eventTitle || payload.event_title || payload.activity || payload.raid);
  if (!title) {
    throw Object.assign(new Error('请选择要报名的活动'), { statusCode: 400 });
  }

  const candidates = db.prepare(`
    SELECT *
    FROM events
    WHERE title = ?
    ORDER BY event_date ASC, COALESCE(start_time, '23:59') ASC, id ASC
  `).all(title);

  return candidates.find(event => !isEventExpired(event)) || null;
}

function listSignupOptions() {
  const rows = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_members em WHERE em.event_id = e.id) +
      (SELECT COUNT(*) FROM event_guest_signups eg WHERE eg.event_id = e.id) AS member_count
    FROM events e
    ORDER BY e.event_date ASC, COALESCE(e.start_time, '23:59') ASC, e.id ASC
  `).all();

  return rows
    .filter(event => !isEventExpired(event))
    .filter(event => event.member_count < MAX_SIGNUP_COUNT)
    .map(event => ({
      ...event,
      capacity: MAX_SIGNUP_COUNT,
      remaining: Math.max(0, MAX_SIGNUP_COUNT - event.member_count)
    }));
}

function signupActivity(payload = {}) {
  const submittedName = cleanText(payload.name || payload.nickname || payload.username);
  if (!submittedName) {
    throw Object.assign(new Error('请输入报名名称'), { statusCode: 400 });
  }
  if (submittedName.length > 32) {
    throw Object.assign(new Error('报名名称不能超过 32 个字符'), { statusCode: 400 });
  }

  const event = findEventForSignup(payload);
  if (!event) {
    throw Object.assign(new Error('没有找到可报名活动，请确认活动名称或联系管理员'), { statusCode: 404 });
  }
  if (isEventExpired(event)) {
    throw Object.assign(new Error(`活动已过期或已关闭：${event.title}`), { statusCode: 409 });
  }

  const member = findMemberByName(submittedName);
  const signupMember = member || {
    id: null,
    nickname: submittedName,
    role: '访客报名',
    avatar: null,
    is_guest: true
  };

  const exists = member
    ? db.prepare('SELECT id FROM event_members WHERE event_id = ? AND member_id = ?').get(event.id, member.id)
    : db.prepare('SELECT id FROM event_guest_signups WHERE event_id = ? AND signup_name = ? COLLATE NOCASE').get(event.id, submittedName);

  const currentCount = getEventMemberCount(event.id);
  if (!exists && currentCount >= MAX_SIGNUP_COUNT) {
    throw Object.assign(new Error(`活动已满员：${event.title}（${MAX_SIGNUP_COUNT}/${MAX_SIGNUP_COUNT}）`), {
      statusCode: 409
    });
  }

  if (!exists) {
    if (member) {
      db.prepare('INSERT INTO event_members (event_id, member_id) VALUES (?, ?)').run(event.id, member.id);
    } else {
      db.prepare('INSERT INTO event_guest_signups (event_id, signup_name) VALUES (?, ?)').run(event.id, submittedName);
    }
  }

  const members = listMembers(event.id);
  return {
    ok: true,
    duplicated: Boolean(exists),
    event,
    member: signupMember,
    members,
    joinedCount: members.length,
    capacity: MAX_SIGNUP_COUNT,
    message: exists
      ? `${signupMember.nickname} 已在【${event.title}】名单里`
      : `${signupMember.nickname} 已报名【${event.title}】（${members.length}/${MAX_SIGNUP_COUNT}）`
  };
}

function cancelSignupActivity(payload = {}) {
  const submittedName = cleanText(payload.name || payload.nickname || payload.username);
  if (!submittedName) {
    throw Object.assign(new Error('请输入取消报名的名称'), { statusCode: 400 });
  }
  if (submittedName.length > 32) {
    throw Object.assign(new Error('报名名称不能超过 32 个字符'), { statusCode: 400 });
  }

  const event = findEventForSignup(payload);
  if (!event) {
    throw Object.assign(new Error('没有找到可取消报名的活动，请确认活动名称或联系管理员'), { statusCode: 404 });
  }
  if (isEventExpired(event)) {
    throw Object.assign(new Error(`活动已过期或已关闭：${event.title}`), { statusCode: 409 });
  }

  const member = findMemberByName(submittedName);
  const removeSignup = db.transaction(() => {
    let removedCount = 0;
    if (member) {
      removedCount += db.prepare(`
        DELETE FROM event_members WHERE event_id = ? AND member_id = ?
      `).run(event.id, member.id).changes;
    }
    removedCount += db.prepare(`
      DELETE FROM event_guest_signups
      WHERE event_id = ? AND signup_name = ? COLLATE NOCASE
    `).run(event.id, submittedName).changes;
    return removedCount;
  });

  const removedCount = removeSignup();
  const members = listMembers(event.id);
  return {
    ok: true,
    cancelled: removedCount > 0,
    event,
    member: member || {
      id: null,
      nickname: submittedName,
      role: '访客报名',
      avatar: null,
      is_guest: true
    },
    members,
    joinedCount: members.length,
    capacity: MAX_SIGNUP_COUNT,
    message: removedCount > 0
      ? `${submittedName} 已取消【${event.title}】报名（${members.length}/${MAX_SIGNUP_COUNT}）`
      : `${submittedName} 不在【${event.title}】报名名单中`
  };
}

function replaceEventRoster(payload = {}) {
  const eventId = Number.parseInt(payload.eventId || payload.event_id, 10);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw Object.assign(new Error('活动 ID 无效'), { statusCode: 400 });
  }

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) {
    throw Object.assign(new Error('活动不存在'), { statusCode: 404 });
  }

  if (!Array.isArray(payload.names)) {
    throw Object.assign(new Error('names 必须是游戏名字数组'), { statusCode: 400 });
  }

  const names = [];
  const seenNames = new Set();
  for (const value of payload.names) {
    const name = cleanText(value);
    if (!name) continue;
    if (name.length > 32) {
      throw Object.assign(new Error(`游戏名字不能超过 32 个字符：${name}`), { statusCode: 400 });
    }
    const key = name.toLocaleLowerCase('zh-CN');
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    names.push(name);
  }

  if (!names.length && !payload.allowEmpty) {
    throw Object.assign(new Error('金山文档中没有读取到游戏名字，已拒绝清空网站名单'), { statusCode: 400 });
  }
  if (names.length > MAX_SIGNUP_COUNT) {
    throw Object.assign(new Error(`报名人数不能超过 ${MAX_SIGNUP_COUNT} 人`), { statusCode: 400 });
  }

  const sync = db.transaction(() => {
    db.prepare('DELETE FROM event_members WHERE event_id = ?').run(eventId);
    db.prepare('DELETE FROM event_guest_signups WHERE event_id = ?').run(eventId);

    const registeredIds = new Set();
    const guestNames = new Set();
    for (const name of names) {
      const member = findMemberByName(name);
      if (member) {
        if (registeredIds.has(member.id)) continue;
        registeredIds.add(member.id);
        db.prepare('INSERT INTO event_members (event_id, member_id) VALUES (?, ?)').run(eventId, member.id);
        continue;
      }

      const key = name.toLocaleLowerCase('zh-CN');
      if (guestNames.has(key)) continue;
      guestNames.add(key);
      db.prepare('INSERT INTO event_guest_signups (event_id, signup_name) VALUES (?, ?)').run(eventId, name);
    }
  });

  sync();
  const members = listMembers(eventId);
  return {
    ok: true,
    event,
    members,
    joinedCount: members.length,
    capacity: MAX_SIGNUP_COUNT,
    syncedAt: new Date().toISOString()
  };
}

function ensureWeeklyEvent(payload = {}) {
  const title = cleanText(payload.title || payload.eventTitle || payload.event_title);
  if (!title) {
    throw Object.assign(new Error('活动名称不能为空'), { statusCode: 400 });
  }
  if (title.length > 64) {
    throw Object.assign(new Error('活动名称不能超过 64 个字符'), { statusCode: 400 });
  }

  const eventDate = currentChinaWeekMonday();
  const startTime = cleanText(payload.startTime || payload.start_time) || '19:30';
  const type = cleanText(payload.type) || '副本';
  if (!parseChinaEventStart({ event_date: eventDate, start_time: startTime })) {
    throw Object.assign(new Error('活动开始时间格式不正确'), { statusCode: 400 });
  }

  let event = db.prepare(`
    SELECT *
    FROM events
    WHERE title = ? AND event_date = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(title, eventDate);
  let created = false;

  if (!event) {
    const result = db.prepare(`
      INSERT INTO events (title, type, event_date, start_time, leader, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      title,
      type,
      eventDate,
      startTime,
      '金山文档同步',
      '由金山文档定时同步自动创建'
    );
    event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    created = true;
  }

  return { event, created, weekStart: eventDate };
}

function replaceWeeklyEventRoster(payload = {}) {
  const ensured = ensureWeeklyEvent(payload);
  const synced = replaceEventRoster({
    eventId: ensured.event.id,
    names: payload.names,
    allowEmpty: payload.allowEmpty === true
  });
  return { ...synced, created: ensured.created, weekStart: ensured.weekStart };
}

function getWeeklyEventRoster(titleValue) {
  const title = cleanText(titleValue);
  if (!title) {
    throw Object.assign(new Error('活动名称不能为空'), { statusCode: 400 });
  }
  const weekStart = currentChinaWeekMonday();
  const event = db.prepare(`
    SELECT *
    FROM events
    WHERE title = ? AND event_date = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(title, weekStart);
  if (!event) {
    throw Object.assign(new Error('没有找到本周活动'), { statusCode: 404 });
  }
  const members = listMembers(event.id);
  return {
    event,
    names: members.map(member => member.nickname),
    joinedCount: members.length,
    capacity: MAX_SIGNUP_COUNT,
    weekStart
  };
}

function archiveWeeklyEvent(titleValue, now = new Date()) {
  const current = getWeeklyEventRoster(titleValue);
  const startsAt = parseChinaEventStart(current.event);
  if (!startsAt || now.getTime() < startsAt.getTime()) {
    throw Object.assign(new Error('活动尚未开始，不能提前封存'), { statusCode: 409 });
  }
  const archived = current.event.status !== 'ended';
  if (archived) {
    db.prepare("UPDATE events SET status = 'ended' WHERE id = ?").run(current.event.id);
  }
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(current.event.id);
  return { ...current, event, archived, archivedAt: now.toISOString() };
}

module.exports = {
  MAX_SIGNUP_COUNT,
  signupActivity,
  cancelSignupActivity,
  signupRaid: signupActivity,
  replaceEventRoster,
  replaceWeeklyEventRoster,
  ensureWeeklyEvent,
  getWeeklyEventRoster,
  archiveWeeklyEvent,
  listSignupOptions,
  listMembers,
  getAdminEventRoster,
  addAdminEventSignup,
  removeAdminEventSignup,
  getEventMemberCount,
  isEventExpired,
  isAdminCreatedEvent,
  parseChinaEventStart,
  currentChinaWeekMonday,
  listPendingCreationAnnouncements,
  markCreationAnnouncementSent,
  listDueStartReminders,
  markStartReminderSent
};
