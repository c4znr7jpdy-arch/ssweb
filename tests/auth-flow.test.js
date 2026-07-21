const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yanyun-auth-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDir, 'guild.db');
process.env.ALBUM_UPLOAD_DIR = path.join(tempDir, 'uploads');
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long';
process.env.REGISTRATION_INVITE_CODE = 'test-only-invite';
process.env.BOT_API_TOKEN = 'test-bot-token';
process.env.KDOCS_SYNC_TOKEN = 'test-kdocs-token';

const db = require('../server/db');
const passwordHash = bcrypt.hashSync('legacy-pass', 4);
const userId = db.prepare(`
  INSERT INTO users (
    username, password_hash, role, password_change_required, created_at
  ) VALUES ('ss1', ?, 'member', 1, ?)
`).run(passwordHash, new Date().toISOString()).lastInsertRowid;
const adminPasswordHash = bcrypt.hashSync('admin-test-pass', 4);
db.prepare(`
  INSERT INTO users (
    username, password_hash, role, password_change_required, created_at
  ) VALUES ('admin-test', ?, 'admin', 0, ?)
`).run(adminPasswordHash, new Date().toISOString());
db.prepare(`
  INSERT INTO members (nickname, role, status, sort_order, user_id)
  VALUES ('测试成员', '成员', 'active', 1, ?)
`).run(userId);
const eventId = db.prepare(`
  INSERT INTO events (title, type, event_date, start_time, leader, description)
  VALUES ('移动端报名测试', '副本', '2099-07-13', '20:00', '测试管理员', '公开报名活动')
`).run().lastInsertRowid;

const { startServer } = require('../server/index');

function listen() {
  return new Promise(resolve => {
    const server = startServer(0);
    server.once('listening', () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

test('authentication, profile safety, persistent session, and album ownership', async () => {
  let server = await listen();
  let baseUrl = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';

  async function request(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.cookie = cookie;
    const response = await fetch(`${baseUrl}${url}`, { ...options, headers });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  }

  try {
    const detail = await request('/api/members/1');
    assert.equal(detail.status, 200);
    assert.equal('username' in detail.data.item, false);
    assert.equal('userId' in detail.data.item, false);

    for (const type of ['total', 'month', 'week']) {
      const rank = await request(`/api/rank?type=${type}`);
      assert.equal(rank.status, 200);
      assert.equal(Array.isArray(rank.data), true);
    }

    const unauthorizedRoster = await request(`/api/admin/events/${eventId}/roster`);
    assert.equal(unauthorizedRoster.status, 401);

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin-test', password: 'admin-test-pass' })
    });
    assert.equal(adminLogin.status, 200);

    const missingStartTime = await request('/api/admin/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '缺少时间', type: '副本', event_date: '2099-08-01' })
    });
    assert.equal(missingStartTime.status, 400);

    const confirmedEvent = await request('/api/admin/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '日期确认测试',
        type: '副本',
        event_date: '2099-08-01',
        start_time: '20:00'
      })
    });
    assert.equal(confirmedEvent.status, 201);

    const adminRoster = await request(`/api/admin/events/${confirmedEvent.data.id}/roster`);
    assert.equal(adminRoster.status, 200);
    assert.deepEqual(adminRoster.data.members, []);
    assert.equal(adminRoster.data.capacity, 10);

    const adminAddMember = await request(`/api/admin/events/${confirmedEvent.data.id}/roster`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '测试成员' })
    });
    assert.equal(adminAddMember.status, 201);
    assert.equal(adminAddMember.data.added, true);
    assert.equal(adminAddMember.data.members[0].source, 'member');
    assert.equal(adminAddMember.data.members[0].nickname, '测试成员');
    assert.equal(adminAddMember.data.kdocsSync.reason, 'disabled');

    const adminAddGuest = await request(`/api/admin/events/${confirmedEvent.data.id}/roster`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '后台访客' })
    });
    assert.equal(adminAddGuest.status, 201);
    assert.equal(adminAddGuest.data.joinedCount, 2);
    const addedGuest = adminAddGuest.data.members.find(item => item.nickname === '后台访客');
    assert.equal(addedGuest.source, 'guest');

    const duplicateAdminSignup = await request(`/api/admin/events/${confirmedEvent.data.id}/roster`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '后台访客' })
    });
    assert.equal(duplicateAdminSignup.status, 409);

    const adminDeleteGuest = await request(
      `/api/admin/events/${confirmedEvent.data.id}/roster/guest/${addedGuest.signup_id}`,
      { method: 'DELETE' }
    );
    assert.equal(adminDeleteGuest.status, 200);
    assert.equal(adminDeleteGuest.data.removed, true);
    assert.equal(adminDeleteGuest.data.joinedCount, 1);
    assert.equal(adminDeleteGuest.data.members.some(item => item.nickname === '后台访客'), false);
    assert.equal(adminDeleteGuest.data.kdocsSync.reason, 'disabled');

    const addedMember = adminDeleteGuest.data.members.find(item => item.nickname === '测试成员');
    const adminDeleteMember = await request(
      `/api/admin/events/${confirmedEvent.data.id}/roster/member/${addedMember.signup_id}`,
      { method: 'DELETE' }
    );
    assert.equal(adminDeleteMember.status, 200);
    assert.equal(adminDeleteMember.data.joinedCount, 0);

    await request('/api/auth/logout', { method: 'POST' });
    cookie = '';

    const guestSignup = await request('/api/events/raid-signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventId, name: '临时访客' })
    });
    assert.equal(guestSignup.status, 201);
    assert.equal(guestSignup.data.member.nickname, '临时访客');
    assert.equal(guestSignup.data.member.is_guest, true);

    const eventDetail = await request(`/api/events/${eventId}`);
    assert.equal(eventDetail.status, 200);
    assert.equal(eventDetail.data.members.length, 1);
    assert.equal(eventDetail.data.members[0].nickname, '临时访客');
    assert.equal(eventDetail.data.members[0].is_guest, 1);
    assert.equal(eventDetail.data.capacity, 10);
    assert.equal(eventDetail.data.remaining, 9);
    assert.equal(eventDetail.data.signup_allowed, true);

    const botSignup = await request('/api/bot/raid/signup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-token': 'test-bot-token'
      },
      body: JSON.stringify({ eventTitle: '移动端报名测试', name: '临时访客' })
    });
    assert.equal(botSignup.status, 200);
    assert.equal(botSignup.data.duplicated, true);
    assert.equal(botSignup.data.members.length, 1);
    assert.match(botSignup.data.message, /【移动端报名测试】/);

    const pendingAnnouncements = await request('/api/bot/raid/announcements', {
      headers: { 'x-bot-token': 'test-bot-token' }
    });
    assert.equal(pendingAnnouncements.status, 200);
    const pendingEvent = pendingAnnouncements.data.announcements.find(item => item.id === eventId);
    assert.equal(pendingEvent.title, '移动端报名测试');
    assert.equal(pendingEvent.member_count, 1);
    assert.equal(pendingEvent.capacity, 10);

    const announcementAck = await request(`/api/bot/raid/announcements/${eventId}/ack`, {
      method: 'POST',
      headers: { 'x-bot-token': 'test-bot-token' }
    });
    assert.equal(announcementAck.status, 200);
    assert.equal(announcementAck.data.recorded, true);

    const announcementsAfterAck = await request('/api/bot/raid/announcements', {
      headers: { 'x-bot-token': 'test-bot-token' }
    });
    assert.equal(
      announcementsAfterAck.data.announcements.some(item => item.id === eventId),
      false
    );

    const botCancelSignup = await request('/api/bot/raid/cancel', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-token': 'test-bot-token'
      },
      body: JSON.stringify({ eventTitle: '移动端报名测试', name: '临时访客' })
    });
    assert.equal(botCancelSignup.status, 200);
    assert.equal(botCancelSignup.data.cancelled, true);
    assert.equal(botCancelSignup.data.joinedCount, 0);
    assert.equal(botCancelSignup.data.members.length, 0);
    assert.match(botCancelSignup.data.message, /【移动端报名测试】/);
    assert.equal(botCancelSignup.data.kdocsSync.triggered, false);
    assert.equal(botCancelSignup.data.kdocsSync.reason, 'disabled');

    const repeatedBotCancel = await request('/api/bot/raid/cancel', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-token': 'test-bot-token'
      },
      body: JSON.stringify({ eventTitle: '移动端报名测试', name: '临时访客' })
    });
    assert.equal(repeatedBotCancel.status, 200);
    assert.equal(repeatedBotCancel.data.cancelled, false);
    assert.equal(repeatedBotCancel.data.joinedCount, 0);
    assert.equal(repeatedBotCancel.data.kdocsSync.reason, 'unchanged');

    const memberBotSignup = await request('/api/bot/raid/signup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-token': 'test-bot-token'
      },
      body: JSON.stringify({ eventTitle: '移动端报名测试', name: '测试成员' })
    });
    assert.equal(memberBotSignup.status, 201);
    assert.equal(memberBotSignup.data.member.is_guest, undefined);

    const memberBotCancel = await request('/api/bot/raid/cancel', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-token': 'test-bot-token'
      },
      body: JSON.stringify({ eventTitle: '移动端报名测试', name: '测试成员' })
    });
    assert.equal(memberBotCancel.status, 200);
    assert.equal(memberBotCancel.data.cancelled, true);
    assert.equal(memberBotCancel.data.joinedCount, 0);

    const unauthorizedBotCancel = await request('/api/bot/raid/cancel', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-token': 'wrong-token'
      },
      body: JSON.stringify({ eventTitle: '移动端报名测试', name: '测试成员' })
    });
    assert.equal(unauthorizedBotCancel.status, 401);

    const rejectedKdocsSync = await request(`/api/kdocs/events/${eventId}/roster`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kdocs-token': 'wrong-token',
        origin: 'https://www.kdocs.cn'
      },
      body: JSON.stringify({ names: ['测试成员'] })
    });
    assert.equal(rejectedKdocsSync.status, 401);

    const kdocsSync = await request(`/api/kdocs/events/${eventId}/roster`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kdocs-token': 'test-kdocs-token',
        origin: 'https://www.kdocs.cn'
      },
      body: JSON.stringify({ names: ['测试成员', '金山玩家', '金山玩家', ''] })
    });
    assert.equal(kdocsSync.status, 200);
    assert.deepEqual(kdocsSync.data.members.map(member => member.nickname), ['测试成员', '金山玩家']);

    const oldMonday = new Date(`${require('../server/services/raidSignup').currentChinaWeekMonday()}T00:00:00Z`);
    oldMonday.setUTCDate(oldMonday.getUTCDate() - 7);
    const oldMondayText = oldMonday.toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO events (title, type, event_date, start_time, description)
      VALUES ('双10', '副本', ?, '19:30', '上周同名活动')
    `).run(oldMondayText);

    const weeklyKdocsSync = await request('/api/kdocs/events/weekly-roster', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kdocs-token': 'test-kdocs-token'
      },
      body: JSON.stringify({
        title: '双10',
        type: '副本',
        startTime: '19:30',
        names: ['本周玩家一', '本周玩家二']
      })
    });
    assert.equal(weeklyKdocsSync.status, 201);
    assert.equal(weeklyKdocsSync.data.created, true);
    assert.equal(weeklyKdocsSync.data.event.title, '双10');
    assert.equal(
      weeklyKdocsSync.data.event.event_date,
      require('../server/services/raidSignup').currentChinaWeekMonday()
    );
    assert.deepEqual(
      weeklyKdocsSync.data.members.map(member => member.nickname),
      ['本周玩家一', '本周玩家二']
    );

    const repeatedWeeklyKdocsSync = await request('/api/kdocs/events/weekly-roster', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kdocs-token': 'test-kdocs-token'
      },
      body: JSON.stringify({ title: '双10', names: ['本周玩家三'] })
    });
    assert.equal(repeatedWeeklyKdocsSync.status, 200);
    assert.equal(repeatedWeeklyKdocsSync.data.created, false);
    assert.equal(repeatedWeeklyKdocsSync.data.event.id, weeklyKdocsSync.data.event.id);
    assert.deepEqual(repeatedWeeklyKdocsSync.data.members.map(member => member.nickname), ['本周玩家三']);

    const weeklyRosterPull = await request('/api/kdocs/events/weekly-roster?title=%E5%8F%8C10', {
      headers: { 'x-kdocs-token': 'test-kdocs-token' }
    });
    assert.equal(weeklyRosterPull.status, 200);
    assert.equal(weeklyRosterPull.data.event.id, weeklyKdocsSync.data.event.id);
    assert.deepEqual(weeklyRosterPull.data.names, ['本周玩家三']);

    const ensuredWeeklyEvent = await request('/api/kdocs/events/weekly-roster/ensure', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kdocs-token': 'test-kdocs-token'
      },
      body: JSON.stringify({ title: '双10', type: '副本', startTime: '19:30' })
    });
    assert.equal(ensuredWeeklyEvent.status, 200);
    assert.equal(ensuredWeeklyEvent.data.created, false);
    assert.equal(ensuredWeeklyEvent.data.event.id, weeklyKdocsSync.data.event.id);
    assert.deepEqual(
      require('../server/services/raidSignup')
        .getWeeklyEventRoster('双10').names,
      ['本周玩家三']
    );

    const raidSignup = require('../server/services/raidSignup');
    const eventStart = raidSignup.parseChinaEventStart(weeklyRosterPull.data.event);
    assert.throws(
      () => raidSignup.archiveWeeklyEvent('双10', new Date(eventStart.getTime() - 1)),
      error => error.statusCode === 409
    );
    db.prepare('UPDATE events SET start_time = ? WHERE id = ?')
      .run('00:00', weeklyKdocsSync.data.event.id);

    const archiveRequest = await request('/api/kdocs/events/weekly-roster/archive', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kdocs-token': 'test-kdocs-token'
      },
      body: JSON.stringify({ title: '双10' })
    });
    assert.equal(archiveRequest.status, 200);
    assert.equal(archiveRequest.data.archived, true);
    assert.equal(archiveRequest.data.event.status, 'ended');
    assert.deepEqual(archiveRequest.data.names, ['本周玩家三']);
    assert.deepEqual(raidSignup.getWeeklyEventRoster('双10').names, ['本周玩家三']);

    const { isKdocsManagedEvent } = require('../server/services/kdocsWebhook');
    assert.equal(isKdocsManagedEvent(weeklyRosterPull.data.event, '双10'), true);
    assert.equal(isKdocsManagedEvent({ ...weeklyRosterPull.data.event, event_date: oldMondayText }, '双10'), false);
    assert.equal(isKdocsManagedEvent({ ...weeklyRosterPull.data.event, title: '其他活动' }, '双10'), false);

    const rejectedEmptyKdocsSync = await request(`/api/kdocs/events/${eventId}/roster`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kdocs-token': 'test-kdocs-token'
      },
      body: JSON.stringify({ names: [] })
    });
    assert.equal(rejectedEmptyKdocsSync.status, 400);

    const reminderTime = new Date(Date.now() + 5 * 60 * 1000);
    const reminderParts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(reminderTime).filter(part => part.type !== 'literal').map(part => [part.type, part.value])
    );
    const reminderEventId = db.prepare(`
      INSERT INTO events (title, type, event_date, start_time, description)
      VALUES (?, '副本', ?, ?, '开始提醒测试')
    `).run(
      '十分钟提醒测试',
      `${reminderParts.year}-${reminderParts.month}-${reminderParts.day}`,
      `${reminderParts.hour}:${reminderParts.minute}`
    ).lastInsertRowid;

    const dueReminders = await request('/api/bot/raid/reminders?minutes=10', {
      headers: { 'x-bot-token': 'test-bot-token' }
    });
    assert.equal(dueReminders.status, 200);
    assert.equal(dueReminders.data.reminders.some(item => item.id === reminderEventId), true);

    const reminderAck = await request(`/api/bot/raid/reminders/${reminderEventId}/ack`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-token': 'test-bot-token'
      },
      body: JSON.stringify({ minutes: 10 })
    });
    assert.equal(reminderAck.status, 200);

    const remindersAfterAck = await request('/api/bot/raid/reminders?minutes=10', {
      headers: { 'x-bot-token': 'test-bot-token' }
    });
    assert.equal(
      remindersAfterAck.data.reminders.some(item => item.id === reminderEventId),
      false
    );

    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ss1', password: 'legacy-pass' })
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.mustChangePassword, true);

    const blocked = await request('/api/members/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: '不应保存' })
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.code, 'PASSWORD_CHANGE_REQUIRED');

    const changed = await request('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        newPassword: '  NewSecurePass!2026  ',
        confirmPassword: '  NewSecurePass!2026  '
      })
    });
    assert.equal(changed.status, 200);

    const logout = await request('/api/auth/logout', { method: 'POST' });
    assert.equal(logout.status, 200);
    cookie = '';

    const relogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ss1', password: 'NewSecurePass!2026' })
    });
    assert.equal(relogin.status, 200);

    const unsafeAvatar = await request('/api/members/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nickname: '测试成员',
        avatar: '/" onmouseover="alert(1)'
      })
    });
    assert.equal(unsafeAvatar.status, 400);
    assert.equal(db.prepare('SELECT avatar FROM members WHERE id = 1').get().avatar, null);

    const safeAvatar = await request('/api/members/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nickname: '测试成员',
        avatar: ' /images/avatar file.webp '
      })
    });
    assert.equal(safeAvatar.status, 200);
    assert.equal(
      db.prepare('SELECT avatar FROM members WHERE id = 1').get().avatar,
      '/images/avatar%20file.webp'
    );

    const missingApi = await request('/api/does-not-exist');
    assert.equal(missingApi.status, 404);
    assert.equal(missingApi.data.error, 'API endpoint not found');

    const image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#00e5ff' }
    }).webp().toBuffer();

    const wrongOwnerForm = new FormData();
    wrongOwnerForm.append('image', new Blob([image], { type: 'image/webp' }), 'test.webp');
    wrongOwnerForm.append('memberId', '2');
    const wrongOwner = await request('/api/albums/upload', {
      method: 'POST',
      body: wrongOwnerForm
    });
    assert.equal(wrongOwner.status, 403);

    const ownForm = new FormData();
    ownForm.append('image', new Blob([image], { type: 'image/webp' }), 'test.webp');
    ownForm.append('memberId', '1');
    const ownUpload = await request('/api/albums/upload', {
      method: 'POST',
      body: ownForm
    });
    assert.equal(ownUpload.status, 200);

    const publicAlbum = await request('/api/albums?memberId=1');
    assert.equal(publicAlbum.status, 200);
    assert.equal(publicAlbum.data.items.length, 1);
    assert.equal('userId' in publicAlbum.data.items[0], false);

    await close(server);
    server = await listen();
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const persisted = await request('/api/auth/me');
    assert.equal(persisted.status, 200);
    assert.equal(persisted.data.user.username, 'ss1');
    assert.equal(persisted.data.user.mustChangePassword, false);
  } finally {
    if (server.listening) await close(server);
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
