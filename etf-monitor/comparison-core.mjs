export function buildComparison({market,account,balances=[],initialCash=43000}){
 if(!account.start||account.start.date!=='2026-06-01')throw Error('Excel缺少6/1持倉起點');
 const dates=market.filter(x=>x.date>=account.start.date).sort((a,b)=>a.date.localeCompare(b.date));
 if(dates[0]?.date!==account.start.date||!(dates[0].index>0))throw Error('市場資料缺少6/1起點');
 const transactions=new Map();for(const t of account.transactions??[]){const old=transactions.get(t.date)??{bought:0,buyCost:0,sold:0,saleProceeds:0};for(const k of ['bought','buyCost','sold','saleProceeds'])old[k]+=Number(t[k])||0;transactions.set(t.date,old);}
 const checkpoints=new Map(balances.map(b=>[b.date,b]));
 let shares=account.start.shares,cash=initialCash,previousAssets=0,own=1,all0050=1,theory=1;
 let benchmarkAssets=shares*dates[0].price00631L+cash,theoryAssets=benchmarkAssets,pnl=0;
 const rows=[],inferredFlows=[];
 for(let i=0;i<dates.length;i++){
  const m=dates[i];for(const k of ['price00631L','price0050','index'])if(!(m[k]>0))throw Error('市場資料缺值：'+m.date);
  const t=transactions.get(m.date)??{bought:0,buyCost:0,sold:0,saleProceeds:0};
  const flow=(account.externalFlows??[]).filter(f=>f.date===m.date);let incoming=flow.reduce((s,f)=>s+Math.max(0,f.amount),0),outgoing=flow.reduce((s,f)=>s+Math.max(0,-f.amount),0);
  const minimum=Math.max(0,-(cash+incoming-outgoing-t.buyCost+t.saleProceeds));
  if(minimum){incoming+=minimum;inferredFlows.push({date:m.date,amount:minimum,reason:'現金不足當天補足缺口'});}
  shares+=t.bought-t.sold;
  cash+=incoming-outgoing-t.buyCost+t.saleProceeds;
  const checkpoint=checkpoints.get(m.date);
  if(checkpoint){
   if(Math.abs(shares-checkpoint.shares)>1e-6)throw Error('Excel目前股數與每日買賣紀錄不一致，請更新買賣紀錄後儲存');
   const delta=checkpoint.cash-cash;
   if(Math.abs(delta)>.005){if(delta>0)incoming+=delta;else outgoing-=delta;cash=checkpoint.cash;inferredFlows.push({date:m.date,amount:delta,reason:'以該日儲存現金餘額反推未明金流'});}
  }
  const stock=shares*m.price00631L,assets=stock+cash;
  if(!(assets>0)||cash<-.005||shares<0)throw Error('帳戶資料無法計算：'+m.date);
  let dailyReturn=0;
  if(i){
   dailyReturn=(assets+outgoing)/(previousAssets+incoming)-1;
   if(!(dailyReturn>-1))throw Error('帳戶報酬率異常：'+m.date);
   own*=1+dailyReturn;
   const ordinaryDaily=(m.price0050+(m.dividend??0))/dates[i-1].price0050;
   const theoryDaily=1+1.7*(m.index/dates[i-1].index-1);
   if(!(theoryDaily>0))throw Error('理論170%曲線無法繼續計算');
   all0050*=ordinaryDaily;theory*=theoryDaily;
   benchmarkAssets=(benchmarkAssets+incoming)*ordinaryDaily-outgoing;
   theoryAssets=(theoryAssets+incoming)*theoryDaily-outgoing;
   pnl+=assets-previousAssets-incoming+outgoing;
  }
  rows.push({date:m.date,own,all0050,theory,shares,cash,stock,assets,incoming,outgoing,dailyReturn,pnl,exposureRate:2*stock/assets,benchmarkAssets,theoryAssets,gap0050PP:100*(own-all0050),gapTheoryPP:100*(own-theory)});
  previousAssets=assets;
 }
 const last=rows.at(-1);
 return {rows,inferredFlows,summary:{start:rows[0].date,end:last.date,last,initialAssets:rows[0].assets,workbookAsOf:account.asOf,workbookSavedAt:account.savedAt,financialScope:'股票＋投資現金',isEstimated:true,yearNetGrowth:account.cachedNet/account.yearStartNet-1,yearStartNet:account.yearStartNet,currentNetSnapshot:account.cachedNet,workbookCachedPrice:account.cachedPrice}};
}

export function comparisonAlerts(row,tolerance=2){
 if(!Number.isFinite(tolerance)||tolerance<0)throw Error('提醒門檻須為0或正數');
 return {below0050:row.gap0050PP < -1e-8,belowTheory:row.gapTheoryPP < -tolerance-1e-8};
}
