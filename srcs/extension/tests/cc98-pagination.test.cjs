const test = require('node:test');
const assert = require('node:assert/strict');
let core; try { core = require('../cc98-core.js'); } catch {}

test('query normalization rejects untrusted routes and unsafe identifiers', () => {
  assert.ok(core, 'CC98Core must exist');
  for (const q of [{kind:'https://evil.test'}, {kind:'board',boardId:'../1'}, {kind:'conversation',peerId:0}, {kind:'board',boardId:'9007199254740992'}, {kind:'month',year:1999,month:1}, {kind:'month',year:2026,month:13}, {kind:'top',url:'https://evil.test'}]) assert.throws(() => core.normalizeQuery(q));
  assert.deepEqual(core.normalizeQuery({kind:'board',boardId:42,from:0,size:99}), {kind:'board',boardId:'42',from:0,size:20});
  assert.equal(core.requestKey({size:20,kind:'board',boardId:42}), core.requestKey({kind:'board',boardId:'42',from:0}));
});

test('raw new offset is capped at 500 independently of deduplicated items', () => {
  assert.ok(core);
  assert.deepEqual(core.paging({kind:'new',from:480},20), {from:480,size:20,nextFrom:500,hasMore:false,limitReached:true,blocked:false});
  assert.equal(core.paging({kind:'new',from:495,size:20},5).size,5);
  assert.equal(core.paging({kind:'new',from:500},20).blocked,true);
  assert.equal(core.paging({kind:'board',boardId:1,from:0},3).hasMore,false);
  assert.equal(core.paging({kind:'board',boardId:1,from:10000},20).blocked,true);
});
