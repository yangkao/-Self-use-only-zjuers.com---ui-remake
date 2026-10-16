/* Local preview server using Node built-ins only. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
function create(directory){const base=path.resolve(directory),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.ttf':'font/ttf','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};return http.createServer((req,res)=>{
 try{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(base,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname)),relative=path.relative(base,file);if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end();return;}if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(400);res.end('Bad request');}
});}
module.exports={create};
if(require.main===module){const directory=path.resolve(__dirname,'../../bin/demo'),port=Number(process.argv[2]||8765);create(directory).listen(port,'127.0.0.1',()=>console.log('Demo: http://127.0.0.1:'+port+'/'));}
