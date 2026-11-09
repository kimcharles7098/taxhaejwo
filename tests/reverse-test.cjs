const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../salary.html','utf8'),context={};
for(const id of ['salary-table','salary-engine'])vm.runInNewContext(html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1],context);
vm.runInNewContext(fs.readFileSync(__dirname+'/../reverse-engine.js','utf8'),context);
const E=context.SalaryEngine,R=context.ReverseSalaryEngine,base={mode:'monthly',nontax:200000n,month:11,family:1,children:0,ratio:100,insurance:'auto'};let checks=0,maxEvaluations=0;
const reverse=fs.readFileSync(__dirname+'/../reverse.html','utf8');
for(const id of ['salary-table','salary-engine','consult-ui']){const re=new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>');assert.equal(reverse.match(re)[1],html.match(re)[1],id+' must be reused unchanged');checks++;}
for(const id of ['reverse-engine','reverse-ui']){assert.equal(reverse.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1],fs.readFileSync(__dirname+'/../'+id+'.js','utf8'));checks++;}
for(const gross of [300000n,769999n,770000n,1000000n,2500000n,3500000n,6590000n,9999999n,10000000n,10000001n,14000000n,28000001n,87000001n,1000000000n]){
 const target=E.calculate({...base,amount:gross}).net;if(target<=0n)continue;const r=R.solve({...base,target});assert(r.exact);assert.equal(r.net,target);assert(r.gross<=gross);assert.equal(E.calculate({...base,amount:r.gross}).net,target);maxEvaluations=Math.max(maxEvaluations,r.evaluations);checks+=4;
}
for(const options of [{month:2,family:4,children:2,ratio:80},{month:7,family:12,children:5,ratio:120},{family:30,children:20},{insurance:'manual',pension:12345n,health:6789n,care:321n,employment:555n}]){
 const input={...base,...options},target=E.calculate({...input,amount:4000000n}).net,r=R.solve({...input,target});assert(r.exact);assert.equal(r.net,target);checks+=2;
}
const noInsurance={...base,nontax:0n,family:30,insurance:'manual',pension:0n,health:0n,care:0n,employment:0n};
const annual=R.solve({...noInsurance,mode:'annual',target:12000001n});assert.equal(annual.actual,12000000n);assert.equal(annual.gap,-1n);assert.equal(annual.gross,1000000n);checks+=3;
const minimum=R.solve({...noInsurance,nontax:500000n,target:100000n});assert.equal(minimum.gross,500000n);assert.equal(minimum.gap,400000n);checks+=2;
// Check the minimum exact gross around insurance rounding steps and tax-table discontinuities.
for(const original of [1500000n,1999999n,2000000n,2999999n,3000000n]){
 const input={...base,target:E.calculate({...base,amount:original}).net},r=R.solve(input);let smallest=original;
 for(let g=original-1500n;g<=original;g++)if(E.calculate({...base,amount:g}).net===input.target){smallest=g;break;}
 assert.equal(r.gross,smallest);checks++;
}
for(const bad of [{target:0n},{target:-1n},{target:1000000001n},{target:1n,nontax:1000000001n},{target:1n,family:0},{target:1n,ratio:50},{target:1n,mode:'bad'}]){assert.throws(()=>R.solve({...base,...bad}));checks++;}
assert(maxEvaluations<100000,'Search should prune bounded intervals, not scan all salaries');
console.log(JSON.stringify({status:'passed',checks,maxEvaluations,monthlyExample:R.solve({...base,target:3000000n}).gross.toString()}));
