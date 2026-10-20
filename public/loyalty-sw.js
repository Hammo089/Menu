/* Only the public application shell is cached. No API responses, manifests or private links. */
const CACHE='blanco-loyalty-shell-__BUILD__';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    const resources=await fetch('/loyalty-precache.json',{cache:'no-store'}).then(r=>r.json()).catch(()=>[]);
    const safe=Array.isArray(resources)?resources.filter(r=>typeof r==='string'&&/^\/assets\/[a-zA-Z0-9_.-]+\.(js|css)$/.test(r)):[];
    return cache.addAll(['/fidelite','/loyalty-icons/icon-192.png','/loyalty-icons/icon-512.png','/loyalty-icons/apple-touch-icon.png',...safe]);
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('blanco-loyalty-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'&&(url.pathname==='/fidelite'||url.pathname==='/fidelite/confidentialite')){
    event.respondWith(fetch(request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put('/fidelite',response.clone());}return response;}).catch(()=>caches.match('/fidelite').then(r=>r||Response.error())));
    return;
  }
  if(!/^\/(assets\/|fonts\/|loyalty-icons\/)/.test(url.pathname)||url.search)return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}return response;})));
});
