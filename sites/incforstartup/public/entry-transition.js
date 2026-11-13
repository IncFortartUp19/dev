/* DEV-only experiment, loaded by entrada-dev.html. */
(()=>{
  const sessionKey='inc.entry-preview.seen.v1';
  let navigating=false;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('dimension-paused');
  const seen=()=>{try{return sessionStorage.getItem(sessionKey)==='yes'}catch{return false}};
  const remember=()=>{try{sessionStorage.setItem(sessionKey,'yes')}catch{}};
  const navigate=()=>{
    if(!navigating)return;
    navigating=false;
    remember();
    document.body.classList.remove('dimension-entering');
    location.hash='inici';
    requestAnimationFrame(()=>{
      const title=document.querySelector('#view h1');
      if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true})}
    });
  };
  document.addEventListener('click',event=>{
    const core=event.target.closest('.dimension-core');
    if(!core||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    if(navigating)return;
    navigating=true;
    if(reduced()||seen()){navigate();return}
    document.body.classList.add('dimension-entering');
    // Fixed maximum duration: navigation does not depend on animation events.
    setTimeout(navigate,650);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&navigating)navigate()});
  window.addEventListener('hashchange',()=>{
    if(location.hash!=='#entrada'&&location.hash!==''){
      navigating=false;
      document.body.classList.remove('dimension-entering');
    }
  });
  const badge=document.createElement('div');
  badge.className='entry-dev-badge';badge.textContent='DEV · Prova de transició · Textos provisionals';
  document.body.append(badge);
})();
