export const future = days => new Date(Date.now()+days*86400000).toISOString().slice(0,10);
export const config = overrides => ({origins:['airport:HKG'],destinations:['airport:SIN'],mode:'fixed',start:future(20),end:future(23),adults:1,auto_enabled:false,alerts_enabled:true,budget:1500,...overrides});
export function offer(price=1200,to='SIN') {
  return {price,bookingUrl:'https://example.test/booking',outbound:{from:'HKG',to,departureTime:future(20)+'T10:00:00',arrivalTime:future(20)+'T14:00:00',durationSeconds:14400,stops:0},
    inbound:{from:to,to:'HKG',departureTime:future(23)+'T16:00:00',arrivalTime:future(23)+'T20:00:00',durationSeconds:14400,stops:0}};
}
export function source(state) {
  return async request=>{
    if(new URL(request.url).hostname!=='mcp.kiwi.com') throw new Error('Unexpected outgoing destination');
    const body=await request.json();state.calls=(state.calls||0)+1;
    if(body.method==='initialize') return Response.json({jsonrpc:'2.0',id:body.id,result:{protocolVersion:'2025-06-18'}});
    state.args=body.params.arguments;
    if(state.block) await state.block;
    if(state.mode==='failure') return new Response('unavailable',{status:503});
    if(state.mode==='malformed') return Response.json({id:body.id,result:{structuredContent:{unexpected:[]}}});
    const result={structuredContent:{itineraries:state.mode==='empty'?[]:(state.offers||[offer(state.price)])}};
    const payload={jsonrpc:'2.0',id:body.id,result};
    return state.sse?new Response('event: message\r\ndata: '+JSON.stringify(payload)+'\r\n\r\n',{headers:{'Content-Type':'text/event-stream'}}):Response.json(payload);
  };
}
export async function waitFor(fn) {
  for(let i=0;i<150;i++) { const result=await fn();if(result) return result;await new Promise(r=>setTimeout(r,20)); }
  throw new Error('Local task did not reach expected state');
}
