/* SPDX-License-Identifier: GPL-3.0-only
 * Portions adapted with reference to nightTab by zombieFox and contributors.
 * ZJUers-specific modifications by yangkao, 2026-10-15. See THIRD_PARTY_NOTICES.md.
 */
function initializeHome(root, context) {
const prefs = context.prefs;
HomeControls.initialize(root);
let saveQueue = Promise.resolve();
function savePreferences() {
  const snapshot = {...prefs,folds:prefs.remember ? [...prefs.folds] : [false,false,false,false]};
  saveQueue = saveQueue.then(() => HomeExternal.call('preferences-set',{value:snapshot})).catch(error => {
    console.error('偏好保存失败',error); showMessage('设置保存失败，请检查扩展错误。');
  });
}
function showMessage(text) {const el = root.querySelector('.settings-message'); if (el) el.textContent = text;}
const cardIcons = {
  eagle: '<path d="M12 9 9 7 2 3l3 6 4 3-6-2 3 4 5 2-2 5 3-2 3 2-2-5 5-2 3-4-6 2 4-3 3-6-7 4-3 2Z"/><path d="m12 9 1-4 3-1-1 3-2 2M9 12l3 2 3-2"/>',
  scholarship: '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1V5ZM12 6v14M7 9h2M15 9h2"/>',
  '教': '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1V5Z"/><path d="M12 6v14M6 9h3M15 9h3M6 12h3M15 12h3"/>',
  '信': '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8M12 16v5M7 8a7 7 0 0 1 10 0M9 10a4 4 0 0 1 6 0"/><circle cx="12" cy="12" r=".6"/>',
  '浙': '<path d="m3 10 9-6 9 6M5 10v10h14V10M9 20v-6h6v6M8 2v5"/>',
  '学': '<path d="M3 4h12v16H3zM6 8h5M6 11h3"/><circle cx="16" cy="13" r="4"/><path d="m19 16 3 4"/>',
  '习': '<path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v7c4 3 8 3 12 0v-7M22 8v9"/>',
  '工': '<path d="M14 4a5 5 0 0 0-6 6L3 15a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-3-3 2-4Z"/>',
  '其': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  weather: '<path d="M8 17H5a4 4 0 1 1 1-8 6 6 0 0 1 12 1 3.5 3.5 0 1 1 0 7H8Z"/>',
  schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3M7 18h3"/>',
  exam: '<path d="M6 3h9l4 4v14H6V3Zm9 0v5h4M9 12h7M9 15h4M9 18h6"/>',
  assignments: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 3h6v4H9V3ZM8 12l2 2 5-5M8 17h8"/>'
};
let eagleInstance = 0;
function eagleSvg() {
  const id = `qiushi-${++eagleInstance}`;
  // Crop the supplied 318 × 253 emblem around the eagle. The polygon
  // excludes the surrounding ring; white becomes transparent before tinting.
  return `<svg class="qiushi-eagle" viewBox="112 106 85 69" aria-hidden="true"><defs><clipPath id="${id}-crop"><path d="M114 108H196L184 145 156 175 127 145Z"/></clipPath><filter id="${id}-ink" color-interpolation-filters="sRGB"><feColorMatrix result="ink" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 0 0 0 1"/><feFlood flood-color="currentColor"/><feComposite operator="in" in2="ink"/></filter></defs><image href="${context.resource('assets/emblem.png')}" width="318" height="253" clip-path="url(#${id}-crop)" filter="url(#${id}-ink)"/></svg>`;
}
function iconSvg(key) { return key === 'eagle' ? eagleSvg() : HomeIcons.has(key) ? HomeIcons.svg(key) : `<svg viewBox="0 0 24 24" aria-hidden="true">${cardIcons[key]}</svg>`; }

const navController=HomeNavigationUI.initialize(root,context,{iconSvg,savePreferences});

const settings = {
  themes: {kicker:'LOCAL THEMES',title:'主题与壁纸',body:''},
  visual: {kicker:'VISUAL',title:'视觉',body:''},
  greeting: {kicker:'GREETING',title:'问候',body:''},
  campus: { kicker: 'CAMPUS SERVICES', title: '校内服务', body: `<p class="empty-state">正在初始化真实数据界面…</p>` },
  weather: { kicker: 'WEATHER', title: '天气', body: `<p class="empty-state">正在初始化真实数据界面…</p>` },
  appearance: { kicker: 'APPEARANCE', title: '搜索与界面', body: `<section class="settings-section"><h3 class="settings-section-title">搜索</h3><div class="setting-row"><div>默认搜索引擎<small>主界面仍可即时切换</small></div><select class="setting-select" aria-label="默认搜索引擎"><option>Bing</option><option>Google</option><option>必应学术</option></select></div></section><section class="settings-section"><h3 class="settings-section-title">导航</h3><div class="setting-row"><div>记住分组折叠状态<small>首次打开时所有分组默认展开</small></div><button class="setting-button" type="button">关闭</button></div><div class="setting-row"><span>恢复全部展开</span><button class="setting-button" type="button">恢复</button></div></section>` },
  data: { kicker: 'DATA & ABOUT', title: '数据与关于', body: `<p class="empty-state">正在初始化真实数据界面…</p>` }
};

const body = root.querySelector('.app');
const secondary = root.getElementById('secondaryView');
const topbar = root.querySelector('.topbar');
const topbarAnchor = document.createComment('main header location');
topbar.before(topbarAnchor);
const panel = root.getElementById('settingsPanel');
const backdrop = root.getElementById('settingsBackdrop');
function setMainInert(value) {
  root.getElementById('mainView').inert=value;root.querySelector('.search-shell').inert=value;
  root.querySelector('.freshman-guide').inert=value;
}
function openSecondary() { secondary.prepend(topbar);body.classList.add('is-secondary'); secondary.inert=false; secondary.setAttribute('aria-hidden','false'); setMainInert(true); root.dispatchEvent(new CustomEvent('home-secondary-open')); }
function closeSecondary() { if (panel.classList.contains('open')) return;topbarAnchor.after(topbar); body.classList.remove('is-secondary'); secondary.inert=true; secondary.setAttribute('aria-hidden','true'); setMainInert(false); }
function openSettings() { root.__settingsRouter?.open();panel.classList.add('open'); panel.inert=false; panel.setAttribute('aria-hidden','false'); backdrop.hidden = false; secondary.inert=true;root.getElementById('settingsClose').focus(); }
function closeSettings() { root.__settingsRouter?.close();panel.classList.remove('open'); panel.inert=true; panel.setAttribute('aria-hidden','true'); backdrop.hidden = true; secondary.inert=false;root.getElementById('settingsTrigger').focus(); }
secondary.inert=true;panel.inert=true;
root.addEventListener('contextmenu', event => {
  if (body.classList.contains('is-secondary') || navController.editing) return;
  if (event.target.closest('.preview-control, button, input, a, select')) return;
  event.preventDefault(); openSecondary();
});
secondary.addEventListener('click', event => { if (!event.target.closest('.preview-control, button, a, .secondary-heading')) closeSecondary(); });
root.getElementById('settingsTrigger').addEventListener('click', openSettings);
root.getElementById('settingsClose').addEventListener('click', closeSettings);
backdrop.addEventListener('click', closeSettings);
root.addEventListener('keydown', event => { if (event.key === 'Escape') { if (panel.classList.contains('open')) closeSettings(); else if (body.classList.contains('is-secondary')) closeSecondary(); } });
const engineButton = root.getElementById('engineButton');
const engineMenu = root.getElementById('engineMenu');
const engineIcons = {
  Bing: '<path fill="currentColor" stroke="none" d="M5 2v17l5 3 10-6v-5l-10-4 2 6 4 2-6 3V5Z"/>',
  Google: '<path d="M20 8a8 8 0 1 0 1 7v-3h-9" stroke-width="3.5" fill="none" stroke="currentColor"/>',
  '浙大通': cardIcons.eagle,
  '知乎': '<path d="M4 4h7M3 10h9M7 4v9l-4 7M7 13l5 6M15 5h6v13h-6V5Z"/>',
  '有道': '<path d="M4 3h16v18H4z" fill="currentColor" stroke="none"/><path d="M7 7h10M11 5l-4 7M10 10h6v8M10 10v9M10 13h6M10 16h6" stroke="var(--theme-panel,#281733)" stroke-width="1.5"/>',
  'B站': '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m7 2 3 4m7-4-3 4M7 11v4M17 11v4M10 17h4"/>',
  CSDN: '<path d="M5 9C3 5 7 2 12 3s8 3 7 6M5 10c-5-3-5 7 0 5m14-5c5-3 5 7 0 5M5 10c0-5 5-5 7-2 2-3 7-3 7 2v5c0 7-14 7-14 0Z"/><circle cx="8.5" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r=".8" fill="currentColor" stroke="none"/><path d="M9 17q3 2 6 0"/>',
  Github: '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.82c.85 0 1.7.11 2.5.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',
  'GH镜': '',
  '学术词': '<path d="M3 3h15v18H3V3ZM6 7h8M6 11h6M6 15h7M20 6h2v13h-2"/>',
  '学术镜': '<path d="m2 7 10-5 10 5-10 5ZM6 10v6c3 3 7 3 10 1M18 20h5m-2-2 2 2-2 2"/>',
  '学术2': '<path d="m2 7 10-5 10 5-10 5ZM6 10v6c3 3 7 3 10 1M18 17c0-3 5-3 5 0 0 2-5 2-5 5h5"/>'
};
function engineSvg(name) {
  if (name === '浙大通') return eagleSvg();
  if (name === 'GH镜') return `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(0 0) scale(.82)">${engineIcons.Github}</g><rect x="13" y="14" width="11" height="10" rx="3" fill="var(--theme-panel,#281733)" stroke="none"/><path d="M15 19h7m-3-3 3 3-3 3" stroke="currentColor" fill="none" stroke-width="1.8"/></svg>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${engineIcons[name]}</svg>`;
}
engineButton.innerHTML = engineSvg('Bing');
engineMenu.innerHTML = Object.keys(engineIcons).map(name => `<button type="button" data-engine="${name}" aria-pressed="${name === 'Bing'}" class="${name === 'Bing' ? 'selected' : ''}">${engineSvg(name)}<span>${name}</span><span class="engine-check" aria-hidden="true">✓</span></button>`).join('');
function populateEngineSetting() {
  const select = root.querySelector('.setting-select');
  if (select) {select.innerHTML = Object.keys(engineIcons).map(name => `<option>${name}</option>`).join(''); select.value = prefs.engine;}
}
engineButton.addEventListener('click', () => { engineMenu.hidden = !engineMenu.hidden; engineButton.setAttribute('aria-expanded',String(!engineMenu.hidden)); });
const searchInput = root.getElementById('searchInput');
const searchClear = root.getElementById('searchClear');
function closeEngineMenu() { engineMenu.hidden = true; engineButton.setAttribute('aria-expanded','false'); }
engineMenu.addEventListener('click', event => {
  const choice = event.target.closest('[data-engine]'); if (!choice) return;
  selectEngine(choice.dataset.engine); savePreferences();
  closeEngineMenu(); searchInput.focus();
});
searchInput.addEventListener('input', () => { searchClear.hidden = !searchInput.value; });
searchInput.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) {event.preventDefault(); submitSearch();} });
searchClear.addEventListener('click', () => { searchInput.value = ''; searchClear.hidden = true; searchInput.focus(); });
root.getElementById('searchSubmit').addEventListener('click', submitSearch);
engineButton.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') { event.preventDefault(); engineMenu.hidden = false; engineButton.setAttribute('aria-expanded','true'); engineMenu.querySelector('.selected').focus(); }
});
engineMenu.addEventListener('keydown', event => {
  const buttons = [...engineMenu.querySelectorAll('button')];
  const index = buttons.indexOf(root.activeElement);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus(); }
  if (event.key === 'Escape') { event.stopPropagation(); closeEngineMenu(); engineButton.focus(); }
});
root.addEventListener('click', event => { if (!event.target.closest('.engine-menu, .engine-button')) closeEngineMenu(); });
root.getElementById('settingsPanel').addEventListener('click', event => { if (event.target.matches('.setting-button, .pill-group button')) event.target.blur(); });
root.querySelectorAll('.settings-tab').forEach(button => button.addEventListener('click', () => { root.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active')); button.classList.add('active'); const data = settings[button.dataset.tab]; root.getElementById('settingsKicker').textContent = data.kicker; root.getElementById('settingsTitle').textContent = data.title; root.getElementById('settingsBody').innerHTML = data.body; root.querySelector('.settings-content').scrollTop = 0; }));
root.getElementById('settingsBody').innerHTML = settings.campus.body;
root.querySelectorAll('.settings-tab').forEach(button => button.addEventListener('click', populateEngineSetting));

function updateClock() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,day:'numeric',month:'short'}).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type,part.value]));
  const day = Number(values.day);
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'}[day % 10] || 'th');
  root.getElementById('clock').innerHTML = `${values.hour}<span class="time-separator">:</span>${values.minute}${prefs.showSeconds?`<span class="time-separator">:</span>${values.second}`:""}`;
  root.getElementById('date').innerHTML = `${day}${suffix}<span class="date-separator">/</span>${values.month}`;
}
root.querySelectorAll('.info-card').forEach(card => {
  const key = ['weather','schedule','exam','assignments'].find(name => card.classList.contains(`${name}-card`));
  const heading = card.querySelector('.eyebrow');
  heading.insertAdjacentHTML('afterbegin', iconSvg(key));
  if (key !== 'weather') heading.dataset.sourceLink = key;
});
let clockTimer;
function scheduleClock(){clearTimeout(clockTimer);updateClock();const step=prefs.showSeconds?1000:60000;clockTimer=setTimeout(scheduleClock,step-Date.now()%step+10);}
scheduleClock();window.addEventListener('pagehide',()=>clearTimeout(clockTimer),{once:true});
const hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hour12:false}).format(new Date())); root.getElementById('greeting').textContent = `${hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好'}，Yangkao`;
setTimeout(() => root.getElementById('greeting').classList.add('show'), 160);
setTimeout(() => root.getElementById('greeting').classList.remove('show'), 2700);


function selectEngine(name) {
  prefs.engine = name;
  engineButton.innerHTML = engineSvg(name); engineButton.setAttribute('aria-label',`切换搜索引擎：${name}`);
  engineMenu.querySelectorAll('button').forEach(button => {const selected=button.dataset.engine === name;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
  const select=root.querySelector('.setting-select');if(select) select.value=name;
}
function submitSearch() {
  closeEngineMenu(); const url = HomeCore.searchUrl(prefs.engine,searchInput.value);
  if (url) window.open(url,'_blank','noopener,noreferrer'); else searchInput.focus();
}
function applyVisuals() {
  body.classList.toggle('rotate-brand',prefs.rotateLogo);
  body.style.setProperty('--video-brightness',String(.68 + (55-prefs.shade)*.006));
  body.style.setProperty('--secondary-blur',`${prefs.blur*14/36}px`);
  body.classList.toggle('enhanced',prefs.contrast === 'enhanced');
}
function renderSettingsControls() {
  populateEngineSetting();
  const area=root.getElementById('settingsBody');
  if(area.querySelector('.setting-select')){
   const row=document.createElement('label');row.className='setting-row';const label=document.createElement('span');label.textContent='ZJUers 图标旋转';const toggle=document.createElement('input');toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','ZJUers 图标旋转');toggle.checked=prefs.rotateLogo;toggle.onchange=()=>{prefs.rotateLogo=toggle.checked;applyVisuals();savePreferences();};row.append(label,toggle);area.querySelectorAll('.settings-section')[1]?.append(row);
  }
  area.querySelectorAll('.setting-button').forEach(button => {
    const text=button.textContent.trim();
    if (text==='关闭') {button.dataset.action='remember';button.textContent=prefs.remember?'开启':'关闭';button.setAttribute('aria-pressed',String(prefs.remember));}
    else if(text==='恢复')button.dataset.action='expand';
    else if(text==='重置')button.dataset.action='reset';
    else {button.disabled=true;button.title='此功能本轮尚未接入';}
  });
  area.querySelectorAll('.setting-slider').forEach((input,index) => {input.dataset.preference=index===0?'shade':'blur';input.value=prefs[input.dataset.preference];});
  area.querySelectorAll('.pill-group button').forEach((button,index) => {button.dataset.contrast=index?'enhanced':'standard';button.classList.toggle('selected',button.dataset.contrast===prefs.contrast);});
  area.querySelectorAll('.setting-value').forEach(value => {if(value.textContent.includes('静态预览'))value.textContent='0.2.0';});
  const clockRow=document.createElement('div');clockRow.className='setting-row';const label=document.createElement('span');label.textContent='显示秒数';const toggle=document.createElement('button');toggle.type='button';toggle.className='setting-button';toggle.textContent=prefs.showSeconds?'开启':'关闭';toggle.setAttribute('aria-pressed',String(prefs.showSeconds));toggle.onclick=()=>{prefs.showSeconds=!prefs.showSeconds;toggle.textContent=prefs.showSeconds?'开启':'关闭';toggle.setAttribute('aria-pressed',String(prefs.showSeconds));scheduleClock();savePreferences();};clockRow.append(label,toggle);area.append(clockRow);
  area.insertAdjacentHTML('beforeend','<output class="settings-message" aria-live="polite"></output>');
}
function expandAll() {
  navController.expandAll();
  prefs.folds=[false,false,false,false];
  root.querySelectorAll('.nav-section').forEach(section => {
    section.classList.remove('is-collapsed');section.querySelector('.collapse-region').inert=false;
    const button=section.querySelector('.collapse-button');button.setAttribute('aria-expanded','true');button.setAttribute('aria-label',`折叠${section.querySelector('.section-title').textContent}`);
  });
}
root.querySelectorAll('.settings-tab').forEach(button => button.addEventListener('click',renderSettingsControls));
root.getElementById('settingsBody').addEventListener('change',event => {
  if(event.target.matches('.setting-select')) {selectEngine(event.target.value);savePreferences();}
});
root.getElementById('settingsBody').addEventListener('input',event => {
  const key=event.target.dataset.preference;if(!key)return;
  prefs[key]=Number(event.target.value);applyVisuals();savePreferences();
});
root.getElementById('settingsBody').addEventListener('click',event => {
  const action=event.target.dataset.action;
  if(action==='remember') {prefs.remember=!prefs.remember;event.target.textContent=prefs.remember?'开启':'关闭';event.target.setAttribute('aria-pressed',String(prefs.remember));}
  if(action==='expand') expandAll();
  if(action==='reset') {Object.assign(prefs,HomeCore.preferences());expandAll();selectEngine(prefs.engine);applyVisuals();root.getElementById('settingsBody').innerHTML=settings.data.body;renderSettingsControls();}
  if(event.target.dataset.contrast) {prefs.contrast=event.target.dataset.contrast;applyVisuals();event.target.parentElement.querySelectorAll('button').forEach(button=>button.classList.toggle('selected',button===event.target));}
  if(action || event.target.dataset.contrast) {savePreferences();showMessage('界面偏好已更新。');}
});
const guideButton=root.querySelector('.freshman-guide');
guideButton.setAttribute('aria-label','打开2026新生宝典');
guideButton.addEventListener('click',()=>window.open(context.guideInfo.href,'_blank','noopener,noreferrer'));
if(context.guideInfo.title)guideButton.dataset.tip=context.guideInfo.title;
const tooltip=document.createElement('div');tooltip.className='nav-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');root.querySelector('.app').append(tooltip);
function showTip(element) {
  tooltip.textContent=element.dataset.tip;tooltip.hidden=false;
  const rect=element.getBoundingClientRect();const left=Math.max(12,Math.min(innerWidth-tooltip.offsetWidth-12,rect.left));
  tooltip.style.left=`${left}px`;tooltip.style.top=`${Math.max(8,rect.top-tooltip.offsetHeight-9)}px`;
}
root.addEventListener('pointerover',event=>{const el=event.target.closest('[data-tip]');if(el)showTip(el);});
root.addEventListener('pointerout',()=>tooltip.hidden=true);
root.addEventListener('focusin',event=>{const el=event.target.closest('[data-tip]');if(el)showTip(el);});
root.addEventListener('focusout',()=>tooltip.hidden=true);
window.addEventListener('scroll',()=>tooltip.hidden=true,{passive:true});
window.addEventListener('resize',()=>tooltip.hidden=true,{passive:true});
selectEngine(prefs.engine);applyVisuals();renderSettingsControls();
root.querySelector('video').muted=true;
HomeCustomize.initialize(root,{...context,openSecondary,openSettings});
root.__settingsBase={appearance(){root.getElementById('settingsBody').insertAdjacentHTML('beforeend',settings.appearance.body);renderSettingsControls();},editNavigation(){closeSettings();closeSecondary();if(!navController.editing)root.querySelector('.nav-edit-toggle').click();},reset(){Object.assign(prefs,HomeCore.preferences());expandAll();selectEngine(prefs.engine);applyVisuals();scheduleClock();savePreferences();}};
if(globalThis.HomeWidgetsUI)HomeWidgetsUI.initialize(root,{...context,openSecondary,openSettings});
if(globalThis.HomeSettings)HomeSettings.initialize(root,context);
}
