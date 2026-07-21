const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(
  path.join(__dirname, '..', 'integrations', 'kdocs-roster-sync.js'),
  'utf8'
);

function runArchive({ archiveStatus = 200 } = {}) {
  const writes = [];
  const requests = [];
  const ranges = {
    'B3:B12': {
      get Value2() {
        return [['玩家一'], ['玩家二'], ...Array.from({ length: 8 }, () => [''])];
      },
      set Value2(value) {
        writes.push({ range: 'B3:B12', value: JSON.parse(JSON.stringify(value)) });
      }
    },
    'B3:C12': {
      set Value2(value) {
        writes.push({ range: 'B3:C12', value: JSON.parse(JSON.stringify(value)) });
      }
    }
  };

  const sandbox = {
    Application: {
      Worksheets: {
        Item() {
          return {
            Range(range) {
              assert.ok(ranges[range], `unexpected range: ${range}`);
              return ranges[range];
            }
          };
        }
      }
    },
    Context: { argv: { direction: 'archive_and_clear' } },
    HTTP: {
      fetch(url, options) {
        requests.push({ url, options });
        const isArchive = url.endsWith('/archive');
        return {
          status: isArchive ? archiveStatus : 200,
          json: () => ({ ok: true }),
          text: () => 'request failed'
        };
      }
    }
  };

  let error;
  try {
    vm.runInNewContext(script, sandbox);
  } catch (caught) {
    error = caught;
  }
  return { error, requests, writes };
}

test('archive clears B3:C12 only after the website event is archived', () => {
  const result = runArchive();
  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 2);
  assert.deepEqual(result.writes, [{
    range: 'B3:C12',
    value: Array.from({ length: 10 }, () => ['', ''])
  }]);
});

test('archive failure preserves both roster columns', () => {
  const result = runArchive({ archiveStatus: 500 });
  assert.match(result.error.message, /封存网站活动失败/);
  assert.deepEqual(result.writes, []);
});
