import {writeFileSync, mkdirSync} from 'node:fs';
const SR=44100,DURATION=25,BPM=120,b=n=>n*60/BPM,N=SR*DURATION;
const L=new Float64Array(N),R=new Float64Array(N);
let seed=241024;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/2147483648-1};
function put(start,duration,fn,pan=0){const first=Math.round(start*SR),len=Math.round(duration*SR);for(let j=0;j<len && first+j<N;j++){const t=j/SR, s=fn(t,j,len);L[first+j]+=s*(.8-pan*.2);R[first+j]+=s*(.8+pan*.2);}}
const chords=[[130.81,155.56,196,233.08,293.66],[103.83,130.81,155.56,196,261.63],[87.31,103.83,130.81,155.56,196],[98,123.47,146.83,174.61,220]];
for(let beat=0;beat<50;beat++){
 const chord=chords[Math.floor(beat/8)%4];
 put(b(beat),.32,t=>.33*Math.sin(2*Math.PI*(47*t+9*(1-Math.exp(-t*30))))*Math.exp(-t*18));
 if(beat%2===1) put(b(beat),.14,t=>.045*noise()*Math.exp(-t*36)+.012*Math.sin(2*Math.PI*178*t)*Math.exp(-t*24));
 for(const off of [0,.5]) put(b(beat+off),.045,t=>.016*noise()*Math.exp(-t*85),off===0?-.3:.3);
 if(beat%2===0) {const bass=chord[0]/2;put(b(beat),.6,t=>.11*(Math.sin(2*Math.PI*bass*t)+.15*Math.sin(4*Math.PI*bass*t))*Math.min(1,t*180)*Math.exp(-t*5));}
 if(beat%4===0 || beat%8===7) chord.forEach((f,k)=>put(b(beat)+k*.012,1.9,t=>.035*(Math.sin(2*Math.PI*f*t)+.2*Math.sin(2*Math.PI*f*2*t)*Math.exp(-t*6))*(1-Math.exp(-t*180))*Math.exp(-t*2.7), (k-2)*.25));
 if(beat%8===3) put(b(beat)+.02,.5,t=>.027*Math.sin(2*Math.PI*chord[4]*2*t)*(1-Math.exp(-t*150))*Math.exp(-t*8),.5);
}
for(const beat of [10,20,30,40]){put(b(beat)-b(.5),b(.5),t=>.022*noise()*Math.pow(t/b(.5),2));put(b(beat),.35,t=>.11*Math.sin(2*Math.PI*58*t)*Math.exp(-t*14));}
let peak=0;for(let i=0;i<N;i++){const fade=Math.min(1,i/(SR*.04),(N-i)/(SR*1.2));L[i]*=fade;R[i]*=fade;peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));}
const gain=.68/Math.max(.68,peak),out=Buffer.alloc(44+N*4);out.write('RIFF');out.writeUInt32LE(36+N*4,4);out.write('WAVE',8);out.write('fmt ',12);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(SR,24);out.writeUInt32LE(SR*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){out.writeInt16LE(Math.round(Math.tanh(L[i]*gain)*32700),44+i*4);out.writeInt16LE(Math.round(Math.tanh(R[i]*gain)*32700),46+i*4);}
mkdirSync(new URL('../assets/audio/',import.meta.url),{recursive:true});writeFileSync(new URL('../assets/audio/score.wav',import.meta.url),out);console.log('Original score: 25s, 120BPM, stereo PCM; seed241024.');
