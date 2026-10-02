const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');
const fixture = require('./navigation-fixture.json');
test('regroup live navigation without losing preserved links or their hints', () => {
  const groups = core.buildGroups(fixture);
  const links = groups.flatMap(g => g.cards.flatMap(c => c.links));
  const removed = new Set(['bdfy','ggfy','txwd','bdwk']);
  const expected = ['cat1','cat2','cat3','cat4','cat5','cat7','cat9'].flatMap(k => fixture[k]).filter(a => !removed.has(a.id));
  expected.push(...fixture.cat6.filter(a => ['mooc','zhs','xxqg'].includes(a.id)));
  assert.equal(links.length, expected.length + 2);
  for (const link of expected) assert(links.some(a => a.label === link.label && a.href === link.href && a.title === link.title));
  assert.deepEqual(groups.map(g => g.cards.length), [3,2,1,1]);
  assert.equal(links.filter(a => a.label === 'Tuna').length, 1);
  assert(!links.some(a => ['百度翻译','谷歌翻译','腾讯文档','百度文库','知乎','Bilibili'].includes(a.label)));
});
test('search encodes keywords and excludes removed engines', () => {
  assert.equal(core.searchUrl('Bing',' 浙大 & test '), 'https://cn.bing.com/search?q=%E6%B5%99%E5%A4%A7%20%26%20test');
  assert.equal(core.searchUrl('Google','  '), null);
  assert.equal(core.engines.length,12);
  assert(!core.engines.some(e => ['百度','搜狗','360'].includes(e.name)));
});
test('stored preferences reject unknown engines and clamp visual settings', () => {
  const value = core.preferences({engine:'百度',folds:[true,false,true,false],shade:500,blur:-10,remember:false});
  assert.equal(value.engine,'Bing'); assert.deepEqual(value.folds,[false,false,false,false]);
  assert.equal(value.shade,100); assert.equal(value.blur,0);
  assert.equal(core.preferences({engine:'Google',folds:[true]}).engine,'Google');
});
