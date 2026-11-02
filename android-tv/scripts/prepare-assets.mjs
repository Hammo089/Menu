import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = new URL('../../', import.meta.url),
  out = process.argv[2]
    ? pathToFileURL(resolve(process.argv[2]) + '/')
    : new URL('../app/src/main/assets/', import.meta.url);
mkdirSync(out, { recursive: true });
const source = readFileSync(new URL('src/TVMenu.tsx', root), 'utf8');
const begin = source.indexOf('export function renderTvSvg'),
  end = source.indexOf('export function tvTextLayer');
const renderer = ts
  .transpileModule(source.slice(begin, end).replace('export function', 'function'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  })
  .outputText.replace('export function', 'function');
const svg = readFileSync(new URL('src/data/original-menu.svg', root), 'utf8'),
  menu = JSON.parse(readFileSync(new URL('src/data/menu.json', root), 'utf8'));
const font = (name) => readFileSync(new URL('public/fonts/' + name, root)).toString('base64');
const qr = readFileSync(
  new URL('brag-output/composition/assets/images/loyalty-qr.png', root),
).toString('base64');
const html = `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Montserrat;src:url(data:font/ttf;base64,${font('Montserrat-Regular.ttf')})}@font-face{font-family:RocaOne;src:url(data:font/ttf;base64,${font('RocaOne-Rg.ttf')})}*{box-sizing:border-box}body{margin:0;overflow:hidden;background:#fafafa;font-family:Montserrat}#stage{position:absolute;left:50%;top:50%;overflow:hidden}#art{position:absolute;inset:0 0 12%;display:flex;align-items:center;justify-content:center}svg{width:100%;height:100%}#club{position:absolute;bottom:1%;height:10%;left:5%;width:90%;display:flex;align-items:center;justify-content:center;gap:3vw;background:#f4f0e8;border:1px solid #cfc6b7;border-radius:12px;color:#292723}#club img{height:85%;max-width:20%;object-fit:contain}#club strong{font:2.3vh Georgia,serif}#club p{font-size:1.5vh;margin:1vh 0}#club small{font-size:1.2vh}</style><div id="stage"><div id="art"></div><div id="club"><img src="data:image/png;base64,${qr}"><div><strong>Votre fidélité récompensée.</strong><p>Scannez ici pour créer votre carte de fidélité.</p><small>Blanco · Grenoble</small></div></div></div><script>const originalSvg=${JSON.stringify(svg)},initialMenu=${JSON.stringify(menu)};const originalPrice=c=>(c/100).toFixed(2)+'€';${renderer}\nlet orientation='portrait',rotation=0,current=initialMenu;function draw(){const loyalty={enabled:true,qrVisible:true,eyebrow:'LE CLUB BLANCO',title:'Votre fidélité récompensée.',description:'Scannez ici pour créer votre carte de fidélité.',footnote:'Blanco · Grenoble',height:12,position:'bottom',qrSide:'left',background:'#f4f0e8',textColor:'#292723',borderColor:'#cfc6b7',textScale:100,...(current.settings.tvLoyalty||{})};const footer=document.getElementById('club'),art=document.getElementById('art'),space=loyalty.enabled?Math.max(10,Math.min(24,Number(loyalty.height)||12)):0;footer.style.display=loyalty.enabled?'flex':'none';footer.style.height=(space-2)+'%';footer.style.background=loyalty.background;footer.style.color=loyalty.textColor;footer.style.borderColor=loyalty.borderColor;footer.style.flexDirection=loyalty.qrSide==='right'?'row-reverse':'row';footer.style.top=loyalty.position==='top'?'1%':'auto';footer.style.bottom=loyalty.position==='top'?'auto':'1%';art.style.top=loyalty.position==='top'?space+'%':'0';art.style.bottom=loyalty.position==='top'?'0':space+'%';footer.querySelector('strong').textContent=loyalty.title;footer.querySelector('p').textContent=loyalty.description;footer.querySelector('small').textContent=loyalty.footnote;footer.querySelector('img').style.display=loyalty.qrVisible&&(!loyalty.url||loyalty.url==='https://blanco-menu-one.vercel.app/fidelite')?'block':'none';document.body.style.background=current.settings.tvBackground||'#fafafa';const swap=rotation===90||rotation===270,aw=swap?innerHeight:innerWidth,ah=swap?innerWidth:innerHeight,r=orientation==='portrait'?9/16:16/9,w=Math.min(aw,ah*r),h=w/r,s=document.getElementById('stage');s.style.width=w+'px';s.style.height=h+'px';s.style.transform='translate(-50%,-50%) rotate('+rotation+'deg)';document.getElementById('art').innerHTML=renderTvSvg(current);}window.setMenu=(raw,o,r)=>{try{current=JSON.parse(raw);orientation=o;rotation=r;draw();}catch(e){draw();}};window.addEventListener('resize',draw);draw();</script></html>`;
writeFileSync(new URL('offline-menu.html', out), html);
console.log(
  'Offline SVG menu prepared with fonts, public loyalty QR and dynamic product/price reflow.',
);
