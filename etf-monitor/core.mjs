export function exposure({shares,cash,price,multiplier=2}) {
 const holding=shares*price,assets=holding+cash;
 return {holding,assets,amount:multiplier*holding,rate:assets>0?multiplier*holding/assets:null};
}
export function calculate(input) {
 const {shares,cash,price,target,cashFloor=0,feeRate=0.001425,sellFeeRate=feeRate,minFee=20,sellTax=0.001,multiplier=2}=input;
 if(![shares,cash,price,target,cashFloor,feeRate,sellFeeRate,minFee,sellTax,multiplier].every(Number.isFinite)||shares<0||!Number.isInteger(shares)||cash<0||price<=0||target<0||target>multiplier||cashFloor<0||feeRate<0||sellFeeRate<0||minFee<0||sellTax<0||multiplier<=0) throw Error('請確認股數、現金、目標曝險及費用設定。');
 const current=exposure(input);if(current.rate===null)throw Error('帳戶總資產必須大於0。');
 const buy=current.rate<target,side=buy?'buy':'sell';
 const after=q=>{
  const notional=q*price,fee=q?Math.max(minFee,Math.round(notional*(buy?feeRate:sellFeeRate))):0,tax=buy||q===0?0:Math.round(notional*sellTax);
  const newShares=shares+(buy?q:-q),newCash=cash+(buy?-notional-fee:notional-fee-tax);
  return {...exposure({shares:newShares,cash:newCash,price,multiplier}),shares:newShares,cash:newCash,fee,tax,notional,sharesDelta:q};
 };
 let max=buy?Math.floor(Math.max(0,cash-cashFloor)/price):shares;
 if(buy){let lo=0,hi=max;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(after(mid).cash>=cashFloor-1e-8)lo=mid;else hi=mid-1;}max=lo;}
 // Find the integer-share result nearest the target, including trading costs.
 let lo=0,hi=max;while(lo<hi){const mid=Math.floor((lo+hi)/2),rate=after(mid).rate;if(buy?rate<target:rate>target)lo=mid+1;else hi=mid;}
 const candidates=[0,lo,Math.max(0,lo-1),Math.min(max,lo+1)].filter(q=>q<=max&&after(q).assets>0&&after(q).cash>=0);
 const q=candidates.reduce((best,x)=>Math.abs((after(x).rate??0)-target)<Math.abs((after(best).rate??0)-target)?x:best,0),post=after(q);
 const desiredHolding=target/multiplier*current.assets;
 return {current,target,side:q?side:'hold',post,quantity:q,notional:post.notional,fee:post.fee,tax:post.tax,cashChange:post.cash-cash,requiredIgnoringCosts:desiredHolding-current.holding,limited:buy&&after(max).rate<target-1e-6,maxBuyShares:buy?max:0,cashBelowFloor:post.cash<cashFloor,achievedGapPP:100*((post.rate??0)-target)};
}
