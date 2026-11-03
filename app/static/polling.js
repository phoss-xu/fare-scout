/** One in-flight request per poller; hidden pages resume immediately when visible. */
export function visibilityPoll(task,{delay=()=>30000,document:doc=globalThis.document,
  setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout,onError=error=>console.warn('Refresh failed',error)}={}) {
  let active=false,timer,inflight=false,generation=0;
  const clear=()=>{clearTimer(timer);timer=undefined;};
  async function run() {
    clear();
    if(!active || doc.hidden || inflight) return;
    const version=generation;inflight=true;
    try {await task();} catch(error) {onError(error);}
    finally {
      inflight=false;
      if(active && !doc.hidden) timer=setTimer(run,version===generation?delay():0);
    }
  }
  function visible() {clear();if(active && !doc.hidden) void run();}
  doc.addEventListener('visibilitychange',visible);
  return {start(){active=true;generation++;void run();},stop(){active=false;generation++;clear();},
    dispose(){active=false;clear();doc.removeEventListener('visibilitychange',visible);}};
}
