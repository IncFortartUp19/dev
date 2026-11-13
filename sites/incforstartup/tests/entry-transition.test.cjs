const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/entry-transition.js'),'utf8');
function harness({reduced=false,seen=false,storageFails=false}={}){
 const handlers={},timers=[],classes=new Set();let hash='',focused=false,remembered=false;
 const body={classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x)},append(){}};
 vm.runInNewContext(source,{document:{body,addEventListener:(n,f)=>handlers[n]=f,createElement:()=>({}),querySelector:()=>({setAttribute(){},focus(){focused=true}})},window:{addEventListener:(n,f)=>handlers[n]=f},location:{get hash(){return hash},set hash(v){hash=v}},matchMedia:()=>({matches:reduced}),sessionStorage:{getItem(){if(storageFails)throw Error();return seen?'yes':null},setItem(){if(storageFails)throw Error();remembered=true}},setTimeout:(f,ms)=>timers.push({f,ms}),requestAnimationFrame:f=>f()});
 return {click(extra={}){let prevented=false;handlers.click({target:{closest:()=>({})},button:0,preventDefault(){prevented=true},...extra});return prevented},escape(){handlers.keydown({key:'Escape'})},externalNavigation(){hash='projectes';handlers.hashchange()},timers,classes,get hash(){return hash},get focused(){return focused},get remembered(){return remembered}};
}
test('first entry completes after 650ms, focuses destination and remembers session',()=>{const h=harness();h.click();assert.equal(h.hash,'');assert.equal(h.timers[0].ms,650);h.timers[0].f();assert.equal(h.hash,'inici');assert.ok(h.focused&&h.remembered);assert.ok(!h.classes.has('dimension-entering'))});
test('reduced motion and repeat entry navigate immediately',()=>{for(const opts of [{reduced:true},{seen:true}]){const h=harness(opts);h.click();assert.equal(h.hash,'inici');assert.equal(h.timers.length,0)}});
test('double activation does not schedule another transition; Escape skips it',()=>{const h=harness();h.click();h.click();assert.equal(h.timers.length,1);h.escape();assert.equal(h.hash,'inici');h.timers[0].f();assert.equal(h.hash,'inici')});
test('storage disabled does not block entry',()=>{const h=harness({storageFails:true});h.click();h.timers[0].f();assert.equal(h.hash,'inici')});
test('modified link activation is preserved',()=>{const h=harness();assert.equal(h.click({ctrlKey:true}),false);assert.equal(h.timers.length,0)});
test('other navigation cancels pending redirect',()=>{const h=harness();h.click();h.externalNavigation();h.timers[0].f();assert.equal(h.hash,'projectes')});
