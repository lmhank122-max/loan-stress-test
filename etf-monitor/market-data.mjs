export const requestedStart='2026-02-01';
const number=x=>Number(String(x).replaceAll(',',''));
const roc=x=>{const [y,m,d]=x.split('/');return `${+y+1911}-${m}-${d}`;};
export function mergeMarketMonth(retained,p0,p2,idx,dividends,{today,closeReady}){
 const ordinary=new Map(p0.data.map(r=>[roc(r[0]),number(r[6])])),leveraged=new Map(p2.data.map(r=>[roc(r[0]),number(r[6])]));
 let prior=[...retained.values()].filter(r=>r.date<roc(idx.data[0][0])).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 for(const row of idx.data){
  const date=roc(row[0]);if(date<requestedStart||date>today||date===today&&!closeReady)continue;
  const price0050=ordinary.get(date),index=number(row[1]),raw=leveraged.get(date),suspended=date>='2026-03-25'&&date<='2026-03-30';
  if(!(price0050>0&&index>0))continue;
  let price00631L=raw>0?(date<'2026-03-31'?raw/22:raw):null;
  if(!price00631L&&suspended&&prior)price00631L=prior.price00631L;
  if(!(price00631L>0))throw Error('00631L收盤缺漏：'+date);
  const value={date,price0050,price00631L,index,dividend:dividends.get(date)??retained.get(date)?.dividend??0};
  if(suspended){value.suspended=true;value.valuation='previous-close';}
  retained.set(date,value);prior=value;
 }
 return retained;
}
