"""Refresh only Bing official wallpaper metadata; no credentials or image redistribution."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlparse

endpoint='https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN'
with urlopen(Request(endpoint,headers={'User-Agent':'ZJUers-Home-Demo/0.4.0'}),timeout=20) as response:
    image=json.load(response)['images'][0]
url=urljoin('https://cn.bing.com',image['url'])
parsed=urlparse(url)
if parsed.scheme!='https' or parsed.hostname not in ('cn.bing.com','www.bing.com') or parsed.path!='/th':
    raise SystemExit('Unexpected Bing image URL')
record={'date':image['enddate'],'url':url,'copyright':image.get('copyright',''),'title':image.get('title','')}
Path(__file__).with_name('bing.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Bing metadata refreshed: '+record['date'])
