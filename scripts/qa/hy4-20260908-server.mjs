import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const out=path.join(root,'artifacts','codex-hy4-'+new Date().toISOString().replace(/[:.]/g,'-'));
await fs.mkdir(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json','.mp3':'audio/mpeg','.wav':'audio/wav','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/__audit/save'&&req.method==='POST'){
  let chunks=[],size=0;for await(const b of req){size+=b.length;if(size>30e6)throw Error('too large');chunks.push(b);}
  const data=JSON.parse(Buffer.concat(chunks));if(!/^[a-z0-9_-]+$/.test(data.name))throw Error('invalid name');
  if(data.png)await fs.writeFile(path.join(out,data.name+'.png'),Buffer.from(data.png.split(',')[1],'base64'));
  if(data.meta)await fs.writeFile(path.join(out,data.name+'.json'),JSON.stringify(data.meta,null,2));
  res.writeHead(200);return res.end('saved');
 }
 if(url.pathname==='/__audit/client.js'){res.setHeader('Content-Type','text/javascript');return res.end(await fs.readFile(path.join(here,'hy4-20260908-client.js')));}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 const stat=await fs.stat(file);if(stat.isDirectory()){res.writeHead(204);return res.end();}
 let body=await fs.readFile(file);
 if(file.endsWith('index.html')){
  const mute=await fs.readFile(path.join(root,'scripts/silence-browser.js'),'utf8');
  const preserve="const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){return orig.call(this,t,/webgl/.test(t)?Object.assign({},a,{preserveDrawingBuffer:true}):a);};";
  body=Buffer.from(body.toString().replace('<head>','<head><script>'+mute+';'+preserve+'</script>').replace('</body>','<script src="/__audit/client.js"></script></body>'));
 }
 res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(body);
 }catch(e){res.writeHead(404);res.end(String(e.message));}});
server.listen(4176,'127.0.0.1',()=>console.log('Artifacts: '+out+'\nAUDIT http://127.0.0.1:4176/index.html?intro=0&seed=20260908&fx=1&trailer=1'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));process.on('SIGINT',()=>server.close(()=>process.exit(0)));
