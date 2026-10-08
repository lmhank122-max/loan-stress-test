const decoder=new TextDecoder();
function xml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Excel XML格式無效');return doc;}
const tags=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
const date=serial=>new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10);
async function zipEntries(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),entries=new Map();let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw Error('請選擇一般未加密的xlsx檔案');
 const count=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true),expanded=0;
 if(count>1000)throw Error('Excel檔案項目過多');
 for(let i=0;i<count;i++){
  if(view.getUint32(offset,true)!==0x02014b50)throw Error('Excel壓縮目錄無效');
  const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),size=view.getUint32(offset+20,true),length=view.getUint32(offset+24,true),nameLength=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true);
  const name=decoder.decode(bytes.slice(offset+46,offset+46+nameLength));expanded+=length;
  if(flags&1||expanded>40*1024*1024||length>12*1024*1024)throw Error('Excel加密或解壓大小超過限制');
  entries.set(name,{method,size,length,local});offset+=46+nameLength+extra+comment;
 }
 return async name=>{
  const entry=entries.get(name);if(!entry)return null;
  const {local,method,size,length}=entry;if(view.getUint32(local,true)!==0x04034b50)throw Error('Excel壓縮內容無效');
  const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),compressed=bytes.slice(start,start+size);
  let raw=compressed;if(method===8){raw=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());}else if(method!==0)throw Error('不支援此Excel壓縮方式');
  if(raw.length!==length)throw Error('Excel內容長度不符');return decoder.decode(raw);
 };
}
export async function readAccountFile(file){
 if(file.size>15*1024*1024)throw Error('Excel檔案請小於15MB');
 const read=await zipEntries(await file.arrayBuffer()),workbook=xml(await read('xl/workbook.xml')),relationships=xml(await read('xl/_rels/workbook.xml.rels'));
 if(tags(workbook,'workbookPr')[0]?.getAttribute('date1904')==='1')throw Error('目前只支援1900日期制的Excel');
 const shared=await read('xl/sharedStrings.xml'),strings=shared?tags(xml(shared),'si').map(n=>tags(n,'t').map(t=>t.textContent).join('')):[];
 const sheets=new Map();
 for(const info of tags(workbook,'sheet')){
  const name=info.getAttribute('name');if(!['設定與計算','每日損益','加碼金管理'].includes(name))continue;
  const id=info.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),target=tags(relationships,'Relationship').find(r=>r.getAttribute('Id')===id)?.getAttribute('Target');
  if(!target)throw Error('Excel工作表位置無效');const sheet=xml(await read(target.startsWith('/')?target.slice(1):'xl/'+target)),cells=new Map();
  for(const cell of tags(sheet,'c')){const type=cell.getAttribute('t'),value=tags(cell,'v')[0]?.textContent??'';cells.set(cell.getAttribute('r'),type==='s'?strings[Number(value)]:type==='inlineStr'?tags(cell,'t').map(t=>t.textContent).join(''):value);}
  sheets.set(name,{cells,rows:tags(sheet,'row')});
 }
 if(!sheets.has('設定與計算')||!sheets.has('每日損益'))throw Error('需要設定與計算、每日損益兩張工作表');
 const numeric=(cells,key)=>{const value=cells.get(key);if(value===undefined||value===''||!Number.isFinite(Number(value)))throw Error('Excel數值缺漏：'+key+'；請先在Excel儲存計算結果');return Number(value);};
 const settings=sheets.get('設定與計算').cells,daily=sheets.get('每日損益'),transactions=[],positions=[];let start=null;
 for(const row of daily.rows){const n=row.getAttribute('r'),serial=Number(daily.cells.get('A'+n));if(!(serial>=45000))continue;const day=date(serial),shares=numeric(daily.cells,'E'+n);positions.push({date:day,shares});if(day==='2026-06-01')start={date:day,shares,price:numeric(daily.cells,'B'+n)};if(day<='2026-06-01')continue;const bought=numeric(daily.cells,'C'+n),sold=numeric(daily.cells,'N'+n);if(bought||sold)transactions.push({date:day,bought,buyCost:numeric(daily.cells,'D'+n),sold,saleProceeds:numeric(daily.cells,'P'+n)});}
 const account={asOf:date(numeric(settings,'B5')),savedAt:new Date(file.lastModified).toISOString(),shares:numeric(settings,'B10'),cash:numeric(settings,'B12'),living:numeric(settings,'B13'),reserve:numeric(settings,'B19'),debt:numeric(settings,'B14'),yearStartNet:numeric(settings,'B45'),cachedPrice:numeric(settings,'B9'),cachedNet:numeric(settings,'B39'),start,transactions,positions};
 const fees=sheets.get('加碼金管理')?.cells;
 if(fees)account.fees={buy:numeric(fees,'E10'),sell:numeric(fees,'E11'),tax:numeric(fees,'E12')};
 if(!start)throw Error('Excel缺少2026/06/01持倉起點');if(!Number.isInteger(account.shares)||account.shares<0||account.cash<0)throw Error('持股或現金無效');
 return account;
}
