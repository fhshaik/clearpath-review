import assert from 'node:assert/strict';
if(!process.argv.includes('--live'))throw new Error('This race test makes one paid AI call. Pass --live only with an approved budget.');
const base=new URL(process.argv[2]||'http://localhost:5173');
const initialResponse=await fetch(new URL('/api/workspace',base));
const initial=await initialResponse.json(),cookie=initialResponse.headers.get('set-cookie').split(';')[0];
const id=initial.workspace.campaigns[0].id;
const headers={Cookie:cookie,Origin:base.origin,'Content-Type':'application/json'};
const pending=fetch(new URL('/api/analyze',base),{method:'POST',headers,body:JSON.stringify({revision:initial.revision,campaignId:id,version:1,provider:'sponsored',model:'claude-haiku-5-5'})});
let admitted=false;
for(let i=0;i<20;i++){
 const status=await(await fetch(new URL('/api/ai/status',base),{headers:{Cookie:cookie}})).json();
 if(status.remaining===1){admitted=true;break;}
 await new Promise(resolve=>setTimeout(resolve,100));
}
assert.ok(admitted,'AI request should claim its allowance before contacting the provider');
const comment=await fetch(new URL('/api/workspace',base),{method:'POST',headers,body:JSON.stringify({revision:initial.revision,action:{type:'comment',role:'reviewer',campaignId:id,note:'Concurrent human review note must survive the delayed AI result.'}})});
assert.equal(comment.status,200);const human=await comment.json();
const ai=await pending;const aiData=await ai.json();
assert.equal(ai.status,409,JSON.stringify(aiData));
const final=await(await fetch(new URL('/api/workspace',base),{headers:{Cookie:cookie}})).json();
assert.equal(final.revision,human.revision);
assert.equal(final.workspace.events[0].detail,'Concurrent human review note must survive the delayed AI result.');
assert.equal(final.workspace.campaigns[0].versions[0].analysis.mode,'sample');
console.log(JSON.stringify({passed:1,check:'A delayed real AI response cannot overwrite a concurrent human comment',providerAttempts:1,discardedResult:true,usageUnavailableBecauseConflict:true,target:base.origin}));
