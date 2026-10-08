import {buildComparison} from './comparison-core.mjs';
const storage='etf-private-account-v1';let marketCache=null,marketTime=0,inflight=null;
export const marketURL=location.hostname.endsWith('.github.io')?new URL('https://raw.githubusercontent.com/lmhank122-max/loan-stress-test/main/etf-monitor/market.json'):new URL('./market.json',import.meta.url);
export function loadPrivate(){try{return JSON.parse(localStorage.getItem(storage)||'null');}catch{return null;}}
export function validatePrivate(data){
 if(data?.format!=='etf-private-backup-v1'||!data.account?.start||!Number.isFinite(data.initialCash)||data.initialCash<0||!Array.isArray(data.balances)||!Array.isArray(data.account.transactions)||!Array.isArray(data.externalFlows))throw Error('帳戶備份格式不符');
 if(data.externalFlows.some(f=>!/^\d{4}-\d{2}-\d{2}$/.test(f.date)||!Number.isFinite(f.amount)))throw Error('金流日期或金額無效');
 return data;
}
export function savePrivate(data){validatePrivate(data);localStorage.setItem(storage,JSON.stringify(data));}
export function clearPrivate(){localStorage.removeItem(storage);}
async function market(){
 if(marketCache&&Date.now()-marketTime<30000)return marketCache;if(inflight)return inflight;
 inflight=(async()=>{const response=await fetch(marketURL,{cache:'no-store'});if(!response.ok)throw Error('公開行情更新失敗');const data=await response.json();if(!Array.isArray(data.rows)||!data.rows.length||data.rows.some(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!['index','price0050','price00631L'].every(k=>r[k]>0)))throw Error('公開行情格式無效');marketCache=data;marketTime=Date.now();return data;})();
 try{return await inflight;}finally{inflight=null;}
}
async function comparison(){
 const privateData=loadPrivate();if(!privateData)throw Error('請先匯入Excel或私人帳戶備份');validatePrivate(privateData);
 const m=await market(),account={...privateData.account,externalFlows:privateData.externalFlows};
 const result=buildComparison({market:m.rows,account,balances:privateData.balances,initialCash:privateData.initialCash});
 result.summary.marketUpdateError=m.error??null;result.summary.marketCheckedAt=m.checkedAt;result.summary.marketUpdatedAt=m.updatedAt;
 return result;
}
export async function request(route){
 try{
  let data;if(route==='/api/comparison')data=await comparison();else{const m=await market(),last=m.rows.at(-1);if(route==='/api/history')data=m.rows.map(r=>({date:r.date,price:r.price00631L}));else if(route==='/api/latest')data={price:last.price00631L,date:last.date,time:'13:30收盤',stamp:last.date+'T13:30:00+08:00',kind:'close',currentDay:false,source:'證交所每日收盤資料',receivedAt:m.updatedAt,error:m.error??null};else throw Error('不支援的資料請求');}
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({error:e.message}),{status:502,headers:{'Content-Type':'application/json'}});}
}
