const db = require('./db');

const members = [
  { nickname: '风起燕云', role: '社主', tags: 'PVP,活动组织', signature: '一入燕云，皆是江湖', sort_order: 1 },
  { nickname: '听雨', role: '副社', tags: '副本,教学', signature: '听风听雨听江湖', sort_order: 2 },
  { nickname: '长安故梦', role: '管理', tags: 'PVP,拍照', signature: '长安月下，故梦如烟', sort_order: 3 },
  { nickname: '云深不知处', role: '核心成员', tags: '副本,攻略', signature: '云深之处，自有天地', sort_order: 4 },
  { nickname: '半盏清茶', role: '普通成员', tags: '日常,活动', signature: '半盏清茶度流年', sort_order: 5 }
];

const events = [
  { title: '百业团建：汴京集合拍照', type: '团建', event_date: '2026-07-12', start_time: '20:30', leader: '风起燕云', location: '汴京', description: '穿上最好看的衣服，汴京城门集合' },
  { title: '副本教学：英雄本', type: '副本', event_date: '2026-07-14', start_time: '20:00', leader: '听雨', location: '副本入口', description: '带新人过英雄本，老成员优先让位置' },
  { title: 'PVP 3v3 练习赛', type: 'PVP', event_date: '2026-07-16', start_time: '21:00', leader: '长安故梦', description: '提升PVP技术，自由组队' }
];

console.log('插入测试数据...');

const insertMember = db.prepare('INSERT INTO members (nickname, role, tags, signature, sort_order) VALUES (?, ?, ?, ?, ?)');
const insertEvent = db.prepare('INSERT INTO events (title, type, event_date, start_time, leader, location, description) VALUES (?, ?, ?, ?, ?, ?, ?)');
const insertContrib = db.prepare('INSERT INTO contributions (member_id, points, type, reason) VALUES (?, ?, ?, ?)');

const insertAll = db.transaction(() => {
  for (const m of members) {
    insertMember.run(m.nickname, m.role, m.tags, m.signature, m.sort_order);
  }
  for (const e of events) {
    insertEvent.run(e.title, e.type, e.event_date, e.start_time, e.leader, e.location || null, e.description);
  }
  insertContrib.run(1, 30, '组织活动', '组织百业团建');
  insertContrib.run(1, 15, '百业管理', '日常管理');
  insertContrib.run(2, 20, '新人教学', '带新人过副本');
  insertContrib.run(3, 10, '参加活动', '参加团建');
  insertContrib.run(4, 20, '攻略投稿', '副本攻略');
  insertContrib.run(5, 10, '参加活动', '参加PVP练习');
});

insertAll();
console.log('测试数据插入完成！');
