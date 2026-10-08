import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../etf-monitor/market.json');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const closeReady=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())>='14:00';
const numeric=x=>Number(String(x).replaceAll(',','')),roc=x=>{const [y,m,d]=x.split('/');return `${+y+1911}-${m}-${d}`;};
async function get(url,format='json'){let error;for(let i=0;i<3;i++){try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return format==='json'?r.json():r.text();}catch(e){error=e;if(i<2)await new Promise(r=>setTimeout(r,1000));}}throw error;}
export function parseDividends(html){const rows=[];for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>x[1].replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim());if(cells[0]!=='0050')continue;const date=cells.find(x=>/^20\d\d\/\d{2}\/\d{2}$/.test(x)),amount=numeric(cells[4]);if(date&&amount>=0)rows.push({date:date.replaceAll('/','-'),amount});}if(!rows.length)throw Error('0050配息來源無法核對');return rows;}
const stored=JSON.parse(await fs.readFile(file,'utf8')),map=new Map(stored.rows.map(r=>[r.date,r]));
try{
 const dividends=new Map(parseDividends(await get('https://www.twse.com.tw/en/ETFortune-institute/dividendList?startDate=&stkNo=0050','text')).map(x=>[x.date,x.amount]));
 let month=stored.rows.at(-1).date.replaceAll('-','').slice(0,6),end=today.replaceAll('-','').slice(0,6);
 while(month<=end){
  const [p0,p2,index]=await Promise.all([get(`https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${month}01&stockNo=0050&response=json`),get(`https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${month}01&stockNo=00631L&response=json`),get(`https://www.twse.com.tw/indicesReport/TAI50I?date=${month}01&response=json`)]);
  if([p0,p2,index].some(x=>x.stat!=='OK'||!Array.isArray(x.data))){if(month===end&&new Date(today+'T00:00:00Z').getUTCDay()%6===0)break;throw Error('官方收盤資料未齊：'+month);}
  const prices0=new Map(p0.data.map(r=>[roc(r[0]),numeric(r[6])])),prices2=new Map(p2.data.map(r=>[roc(r[0]),numeric(r[6])]));
  for(const r of index.data){const date=roc(r[0]),price0050=prices0.get(date),price00631L=prices2.get(date),value=numeric(r[1]);if((date<today||date===today&&closeReady)&&price0050>0&&price00631L>0&&value>0)map.set(date,{date,price0050,price00631L,index:value,dividend:dividends.get(date)??map.get(date)?.dividend??0});}
  const y=+month.slice(0,4),m=+month.slice(4);month=m===12?`${y+1}01`:`${y}${String(m+1).padStart(2,'0')}`;
 }
 const rows=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)),stamp=new Date().toISOString();await fs.writeFile(file,JSON.stringify({rows,updatedAt:stamp,checkedAt:stamp,error:null}));console.log('Official shared closing date: '+rows.at(-1).date);
}catch(e){await fs.writeFile(file,JSON.stringify({...stored,checkedAt:new Date().toISOString(),error:'公開行情更新失敗：'+e.message+'；沿用已核對收盤，提醒暫停。'}));console.error(e.message);process.exitCode=1;}
