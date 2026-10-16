(function (root) {
  async function replaceFailedTab(api, failedId, markBypass) {
    const original = await api.get(failedId);
    const created = await api.create({
      windowId: original.windowId, index: original.index,
      active: original.active, pinned: original.pinned
    });
    if (!Number.isInteger(created.id)) throw new Error('默认标签未返回有效 ID');
    await markBypass(created.id);
    if (original.groupId >= 0) await api.group({ tabIds: created.id, groupId: original.groupId });
    let latest;
    try { latest = await api.get(failedId); }
    catch { return { createdId: created.id, closed: false, reason: '原标签已不存在' }; }
    if (latest.url !== original.url || latest.pendingUrl !== original.pendingUrl) {
      return { createdId: created.id, closed: false, reason: '原标签已发生其他导航' };
    }
    await api.remove(failedId);
    return { createdId: created.id, closed: true };
  }
  root.NativeReplacement = { replaceFailedTab };
  if (typeof module !== 'undefined') module.exports = root.NativeReplacement;
})(globalThis);
