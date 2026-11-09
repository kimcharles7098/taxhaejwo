globalThis.ReverseSalaryEngine=(()=>{
 'use strict';
 const abs=n=>n<0n?-n:n;
 function solve(i){
  if(!['monthly','annual'].includes(i.mode))throw Error('월급 또는 연봉을 선택해 주세요.');
  const scale=i.mode==='annual'?12n:1n,limit=1000000000n;
  if(typeof i.target!=='bigint'||i.target<=0n||i.target>limit*scale)throw Error('희망 세후 금액은 0원 초과, 월 10억 원 또는 연 120억 원 이하로 입력해 주세요.');
  if(typeof i.nontax!=='bigint'||i.nontax<0n||i.nontax>limit)throw Error('월 비과세 금액은 0~10억 원으로 입력해 주세요.');
  const lower=i.nontax>0n?i.nontax:1n,cache=new Map();let best=null;
  function evaluate(gross){
   if(cache.has(gross))return cache.get(gross);
   const value=SalaryEngine.calculate({...i,mode:'monthly',amount:gross}),actual=value.net*scale,error=abs(actual-i.target);
   const candidate={...value,actual,error,gap:actual-i.target};cache.set(gross,candidate);
   if(!best||error<best.error||(error===best.error&&gross<best.gross))best=candidate;
   return candidate;
  }
  // This initial binary search only seeds a close candidate; it is not the correctness check.
  let lo=lower,hi=limit;evaluate(lo);evaluate(hi);
  while(lo<hi){const mid=(lo+hi)/2n;if(evaluate(mid).actual<i.target)lo=mid+1n;else hi=mid;}evaluate(lo);
  const cuts=new Set([lower,limit+1n]);
  for(const row of SalaryTaxTable.rows)for(const value of [row[0],row[1]]){const cut=i.nontax+BigInt(value)*1000n;if(cut>lower&&cut<=limit)cuts.add(cut);}
  const points=[...cuts].sort((a,b)=>a<b?-1:a>b?1:0);
  function search(a,b){
   if(a>b||(best.error===0n&&a>=best.gross))return;
   const left=evaluate(a),right=evaluate(b);
   // Within a tax-table interval, deductions are nondecreasing, even when net pay drops at a rounding step.
   const low=(a-right.deductions)*scale,high=(b-left.deductions)*scale;
   const distance=i.target<low?low-i.target:i.target>high?i.target-high:0n;
   if(distance>best.error||(distance===best.error&&a>=best.gross))return;
   if(b-a<=32n){for(let gross=a;gross<=b;gross++)evaluate(gross);return;}
   const mid=(a+b)/2n;search(a,mid);search(mid+1n,b);
  }
  for(let n=0;n<points.length-1;n++)search(points[n],points[n+1]-1n);
  return {...best,target:i.target,mode:i.mode,exact:best.error===0n,evaluations:cache.size};
 }
 return Object.freeze({solve});
})();
