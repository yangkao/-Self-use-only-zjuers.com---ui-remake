(function(root) {
  const engines = [
    ['Bing','https://cn.bing.com/search?q='], ['Google','https://www.google.com/search?q='],
    ['浙大通','https://s1.zju.edu.cn/search/all.do?words='], ['知乎','https://www.zhihu.com/search?q='],
    ['有道','https://dict.youdao.com/w/eng/'], ['B站','https://search.bilibili.com/all?keyword='],
    ['CSDN','https://so.csdn.net/so/search/s.do?q='], ['Github','https://github.com/search?q='],
    ['GH镜','https://kkgithub.com/search?q='], ['学术词','http://termonline.cn/search?searchText='],
    ['学术镜','https://scholar.lanfanshu.cn/scholar?&q='], ['学术2','https://sc.panda985.com/scholar?hl=zh-cn&q=']
  ].map(([name,url]) => ({name,url}));
  function searchUrl(name, text) {
    const query = text.trim();
    return query ? (engines.find(e => e.name === name) || engines[0]).url + encodeURIComponent(query) : null;
  }
  function buildGroups(categories) {
    const read = key => {
      if (!Array.isArray(categories[key]) || !categories[key].length) throw new Error(`原站栏目结构缺失：${key}`);
      return categories[key];
    };
    const card = (title,icon,key) => ({title,icon,links:read(key)});
    const removed = new Set(['bdfy','ggfy','txwd','bdwk']);
    return [
      {title:'浙大',cards:[card('教学','教','cat1'),card('信息化服务','信','cat2'),card('其它','浙','cat3')]},
      {title:'学术',cards:[card('学术搜索 · 查重','学','cat4'),{title:'学习',icon:'习',links:read('cat6').filter(a => ['mooc','zhs','xxqg'].includes(a.id))}]},
      {title:'实用工具',cards:[{title:'实用工具',icon:'工',wide:true,links:[...read('cat5'),...read('cat7')].filter(a => !removed.has(a.id)).concat([
        {label:'刘明野工具箱',href:'https://tools.liumingye.cn/#/',target:'_blank'},
        {label:'Tuna',href:'https://mirrors.tuna.tsinghua.edu.cn/',target:'_blank'}
      ])}]},
      {title:'其它 · 关于本站',cards:[{...card('其它 · 关于本站','其','cat9'),wide:true}]}
    ];
  }
  function preferences(stored = {}) {
    const clamp = (value,fallback) => Number.isFinite(Number(value)) ? Math.min(100,Math.max(0,Number(value))) : fallback;
    const remember = stored.remember !== false;
    return {engine:engines.some(e => e.name === stored.engine) ? stored.engine : 'Bing',remember,
      folds:Array.from({length:4},(_,i) => remember && stored.folds?.[i] === true),
      shade:clamp(stored.shade,55),blur:clamp(stored.blur,36),contrast:stored.contrast === 'enhanced' ? 'enhanced' : 'standard'};
  }
  root.HomeCore = {engines, searchUrl, buildGroups, preferences};
  if (typeof module !== 'undefined') module.exports = root.HomeCore;
})(globalThis);
