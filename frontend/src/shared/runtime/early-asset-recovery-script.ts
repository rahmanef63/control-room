/**
 * Inlined into the document <head> via layout.tsx so it runs BEFORE any
 * Next.js chunk or CSS link is even fetched. When the browser fails to
 * load a `/_next/static/...` asset (4xx, network error), we purge the
 * service worker + Cache Storage and reload with a cache-buster.
 *
 * Why inline: if a JS chunk 404s, our React error handler never gets to
 * run — the page is stuck unstyled or blank. This handler is plain ES5,
 * fits in a few hundred bytes, and registers a capture-phase listener so
 * resource errors on <link> and <script> bubble up here first.
 *
 * Loop guard via sessionStorage matches the JS-side `claimAutoReloadOnce`
 * key so we never reload twice within 90s.
 */
export const EARLY_ASSET_RECOVERY_SCRIPT = `
(function(){
  var KEY='vps-control-room:auto-reload-at',MS=90000;
  function claim(){try{var l=parseInt(sessionStorage.getItem(KEY)||'0',10);if(isFinite(l)&&Date.now()-l<MS)return false;sessionStorage.setItem(KEY,String(Date.now()));return true;}catch(e){return false;}}
  function bust(){try{var u=new URL(location.href);u.searchParams.set('_v',Date.now().toString(36));location.replace(u.toString());}catch(e){location.reload();}}
  function purge(){
    var done=false,timer=setTimeout(function(){if(done)return;done=true;bust();},3000);
    function finish(){if(done)return;done=true;clearTimeout(timer);bust();}
    try{
      var swP=('serviceWorker' in navigator)?navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister().catch(function(){});}));}).catch(function(){}):Promise.resolve();
      swP.then(function(){return ('caches' in self)?caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k).catch(function(){});}));}):null;}).then(finish,finish);
    }catch(e){finish();}
  }
  window.addEventListener('error',function(e){
    var t=e.target;if(!t||t===window)return;
    var u=t.src||t.href;if(typeof u!=='string')return;
    if(u.indexOf('/_next/static/')===-1)return;
    if(!claim())return;
    purge();
  },true);
})();
`.trim();
