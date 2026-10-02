async function refresh() {
  document.getElementById('version').textContent=`版本 ${chrome.runtime.getManifest().version}`;
  const {diagnostics = [],entries = {}}=await chrome.storage.session.get(['diagnostics','entries']);
  document.getElementById('records').textContent=JSON.stringify({diagnostics,entries},null,2);
}
document.getElementById('refresh').addEventListener('click',refresh);
document.getElementById('copy').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(document.getElementById('records').textContent);document.getElementById('status').textContent='已复制';}
  catch {document.getElementById('status').textContent='复制失败，请手动选取下方文本';}
});
chrome.storage.onChanged.addListener(refresh);
refresh();
