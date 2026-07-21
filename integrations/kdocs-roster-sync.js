// 金山文档 AirScript：将“工作表1”B3:B12 的游戏名字同步到本周“盛世活动-双10”。
// 活动封存成功后清空 B3:C12，C 列不参与报名同步。
// 服务端按中国时间的本周一和活动名定位活动，不存在时自动创建，不保存活动 ID。

const ENDPOINT = 'https://ss.xiuxianjyj.xin/api/kdocs/events/weekly-roster';
const TOKEN = '请填写服务器配置的 KDOCS_SYNC_TOKEN';
const SHEET_NAME = '工作表1';
const NAME_RANGE = 'B3:B12';
const CLEAR_RANGE = 'B3:C12';
const EVENT_TITLE = '双10';
const EVENT_TYPE = '副本';
const START_TIME = '19:30';
const ENSURE_ENDPOINT = `${ENDPOINT}/ensure`;
const ARCHIVE_ENDPOINT = `${ENDPOINT}/archive`;

function readGameNames() {
  const sheet = Application.Worksheets.Item(SHEET_NAME);
  const values = sheet.Range(NAME_RANGE).Value2;
  return values
    .flat()
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function requestOptions(method, body) {
  const options = {
    method,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      'x-kdocs-token': TOKEN
    }
  };
  if (body !== undefined) options.body = JSON.stringify(body);
  return options;
}

function invocationDirection() {
  if (typeof Context === 'undefined' || !Context || !Context.argv) return '';
  return String(Context.argv.direction || '').trim();
}

function syncWebsiteToSheet() {
  const url = `${ENDPOINT}?title=${encodeURIComponent(EVENT_TITLE)}`;
  const response = HTTP.fetch(url, requestOptions('GET'));
  if (response.status !== 200) {
    throw new Error(`读取网站名单失败：HTTP ${response.status} ${response.text()}`);
  }
  const data = response.json();
  const names = Array.isArray(data.names)
    ? data.names.map(value => String(value || '').trim()).filter(Boolean)
    : [];
  if (names.length > 10) {
    throw new Error('网站报名人数超过 B3:B12 可容纳的 10 人。');
  }
  Application.Worksheets.Item(SHEET_NAME).Range(NAME_RANGE).Value2 =
    Array.from({ length: 10 }, (_, index) => [names[index] || '']);
  return { direction: 'website_to_sheet', event: data.event, names };
}

function syncSheetToWebsite() {
  const names = readGameNames();
  if (!names.length) {
    const response = HTTP.fetch(ENSURE_ENDPOINT, requestOptions('POST', {
      title: EVENT_TITLE,
      type: EVENT_TYPE,
      startTime: START_TIME
    }));
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`创建本周活动失败：HTTP ${response.status} ${response.text()}`);
    }
    return response.json();
  }

  const response = HTTP.fetch(ENDPOINT, requestOptions('POST', {
    title: EVENT_TITLE,
    type: EVENT_TYPE,
    startTime: START_TIME,
    names
  }));

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`同步失败：HTTP ${response.status} ${response.text()}`);
  }
  return response.json();
}

function archiveWebsiteAndClearSheet() {
  const latest = syncSheetToWebsite();
  const response = HTTP.fetch(ARCHIVE_ENDPOINT, requestOptions('POST', {
    title: EVENT_TITLE
  }));
  if (response.status !== 200) {
    throw new Error(`封存网站活动失败：HTTP ${response.status} ${response.text()}`);
  }
  const archived = response.json();
  Application.Worksheets.Item(SHEET_NAME).Range(CLEAR_RANGE).Value2 =
    Array.from({ length: 10 }, () => ['', '']);
  return { direction: 'archive_and_clear', latest, archived };
}

function main() {
  const direction = invocationDirection();
  if (direction === 'website_to_sheet') return syncWebsiteToSheet();
  if (direction === 'archive_and_clear') return archiveWebsiteAndClearSheet();
  return syncSheetToWebsite();
}

main();
