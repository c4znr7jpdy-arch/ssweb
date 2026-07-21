const config = require('../config');
const { currentChinaWeekMonday } = require('./raidSignup');

function isKdocsManagedEvent(event, title = config.kdocsEventTitle, weekStart = currentChinaWeekMonday()) {
  return Boolean(
    event
    && String(event.title || '').trim() === String(title || '').trim()
    && String(event.event_date || '').trim() === weekStart
  );
}

async function refreshKdocsRoster(event, fetchImpl = global.fetch) {
  if (!config.kdocsWebsiteToSheetEnabled) {
    return { triggered: false, reason: 'disabled' };
  }
  if (!isKdocsManagedEvent(event)) {
    return { triggered: false, reason: 'event_not_managed' };
  }
  if (!config.kdocsWebhookUrl || !config.kdocsApiToken) {
    return { triggered: false, reason: 'not_configured' };
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('当前 Node.js 环境不支持 fetch');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetchImpl(config.kdocsWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AirScript-Token': config.kdocsApiToken
      },
      body: JSON.stringify({
        Context: {
          argv: {
            direction: 'website_to_sheet',
            eventTitle: event.title,
            eventId: event.id
          }
        }
      }),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!response.ok) {
      throw new Error(`WPS Webhook HTTP ${response.status}: ${data.error || data.message || text}`);
    }
    if (data.error) {
      throw new Error(`WPS AirScript 执行失败: ${data.error}`);
    }
    if (data.status && data.status !== 'finished') {
      throw new Error(`WPS AirScript 状态异常: ${data.status}`);
    }
    return { triggered: true, status: data.status || 'finished' };
  } finally {
    clearTimeout(timer);
  }
}

async function refreshKdocsRosterSafely(event) {
  try {
    return await refreshKdocsRoster(event);
  } catch (error) {
    console.error('网站报名已保存，但同步金山文档失败:', error.message || error);
    return { triggered: false, reason: 'request_failed' };
  }
}

module.exports = {
  isKdocsManagedEvent,
  refreshKdocsRoster,
  refreshKdocsRosterSafely
};
