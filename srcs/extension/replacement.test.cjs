const { test } = require('node:test');
const assert = require('node:assert/strict');
const { replaceFailedTab } = require('./replacement.js');
function fixture() {
  const events = [];
  const original = { id: 7, windowId: 2, index: 3, active: true, pinned: false, groupId: -1, url: 'https://zjuers.com/' };
  const api = {
    get: async () => ({ ...original }),
    create: async options => { events.push(['create', options]); return { id: 8 }; },
    remove: async id => events.push(['remove', id]),
    group: async options => events.push(['group', options])
  };
  const mark = async id => events.push(['mark', id]);
  return { api, events, original, mark };
}
test('create without URL, mark bypass, then close only failed tab', async () => {
  const f = fixture();
  await replaceFailedTab(f.api, 7, f.mark);
  assert.deepEqual(f.events, [
    ['create', { windowId: 2, index: 3, active: true, pinned: false }],
    ['mark', 8], ['remove', 7]
  ]);
});
test('creation failure keeps original tab', async () => {
  const f = fixture(); f.api.create = async () => { throw new Error('creation failed'); };
  await assert.rejects(replaceFailedTab(f.api, 7, f.mark), /creation failed/);
  assert.equal(f.events.some(e => e[0] === 'remove'), false);
});
test('user navigation while creating prevents closing original tab', async () => {
  const f = fixture(); let gets = 0;
  f.api.get = async () => ({ ...f.original, url: ++gets === 1 ? f.original.url : 'https://example.org/' });
  const result = await replaceFailedTab(f.api, 7, f.mark);
  assert.equal(result.closed, false);
  assert.equal(f.events.some(e => e[0] === 'remove'), false);
});
test('preserve background activation, pinned state and group', async () => {
  const f = fixture(); Object.assign(f.original, { active: false, pinned: true, groupId: 10 });
  await replaceFailedTab(f.api, 7, f.mark);
  assert.equal(f.events[0][1].active, false);
  assert.equal(f.events[0][1].pinned, true);
  assert.deepEqual(f.events[2], ['group', { tabIds: 8, groupId: 10 }]);
});
