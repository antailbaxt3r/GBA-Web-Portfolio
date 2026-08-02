import fs from 'node:fs';
import { decodePNG } from '/Users/arjunbajpai/Code/portfolio-2026/tools/png.mjs';
import { Bitmap } from '/Users/arjunbajpai/Code/portfolio-2026/tools/pixel.mjs';
const root='/Users/arjunbajpai/Code/portfolio-2026/public/assets/';
const d=decodePNG(fs.readFileSync(root+'atlas/atlas-game.png'));
const at=new Bitmap(d.width,d.height); at.data.set(d.data);
const j=JSON.parse(fs.readFileSync(root+'atlas/atlas-game.json','utf8'));
const names=['building-work','building-projects','building-about','building-contact'];
let W=8,H=0;
for(const n of names){const f=j.frames[n].frame; W+=f.w+10; H=Math.max(H,f.h);}
const Z=4;
const out=new Bitmap(W*Z,(H+10)*Z);
out.fill(0,0,out.width,out.height,[24,24,32,255]);
let x=6;
for(const n of names){
  const f=j.frames[n].frame, s=at.sub(f.x,f.y,f.w,f.h);
  const z=new Bitmap(f.w*Z,f.h*Z);
  for(let yy=0;yy<z.height;yy++)for(let xx=0;xx<z.width;xx++)z.put(xx,yy,s.get(Math.floor(xx/Z),Math.floor(yy/Z)));
  out.blit(z,x*Z,(H-f.h+5)*Z);
  x+=f.w+10;
}
out.save(process.argv[2]);
console.log('ok');
