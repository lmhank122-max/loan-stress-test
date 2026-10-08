import {request} from './api-client.mjs';
const $=id=>document.getElementById(id);
const pct=v=>(100*(v-1)).toFixed(2)+'%';
const money=v=>Math.round(v).toLocaleString('zh-TW')+' 元';
const pp=v=>(v>=0?'+':'')+v.toFixed(2)+' 個百分點';
let loaded=null,busy=false,lastError=null;
const modeStorage='00631L-comparison-mode-v2';
function pauseAlerts(message){
 $('comparisonUpdateError').textContent='比較更新未完成：'+message+'。本次不判斷是否落後；舊曲線僅代表畫面標示的有效日期。';
 $('comparison0050Alert').className='hint';$('comparison0050Alert').textContent='資料未更新，0050落後提醒暫停。';
 $('comparison170Alert').className='hint';$('comparison170Alert').textContent='資料未更新，理論170%落後提醒暫停。';
 $('comparison170RateAlert').className='hint';$('comparison170RateAlert').textContent='資料未更新，2個百分點提醒暫停。';
}
function render(){
 if(!loaded)return;
 const {rows,summary,inferredFlows}=loaded,index=Number($('performanceDate').value),row=rows[index],selected=rows.slice(0,index+1),wealth=$('comparisonMode').value==='wealth';
 const toleranceText=$('performanceTolerance').value,tolerance=toleranceText!==''?Number(toleranceText):NaN;
 const validTolerance=Number.isFinite(tolerance)&&tolerance>=0;
 $('performanceDay').textContent='查看 '+row.date+' 收盤｜從2026/06/01收盤起算';
 $('performanceActualLabel').textContent=wealth?'你的帳戶資產（估算）':'你的帳戶報酬（估算）';
 $('performance0050Label').textContent=wealth?'100%0050：同金流資產':'100%0050含息報酬';
 $('performanceTheoryLabel').textContent=wealth?'理論170%：同金流資產':'理論每日170%報酬';
 $('performanceActual').textContent=wealth?money(row.assets):pct(row.own);
 $('performance0050').textContent=wealth?money(row.benchmarkAssets):pct(row.all0050);
 $('performanceTheory').textContent=wealth?money(row.theoryAssets):pct(row.theory);
 $('performanceGap0050').textContent=wealth?'相對0050資產差額：'+(row.assets>=row.benchmarkAssets?'+':'−')+money(Math.abs(row.assets-row.benchmarkAssets)):'相對0050報酬差距：'+pp(row.gap0050PP);
 $('performanceGapTheory').textContent=wealth?'相對理論170%資產差額：'+(row.assets>=row.theoryAssets?'+':'−')+money(Math.abs(row.assets-row.theoryAssets)):'相對理論170%報酬差距：'+pp(row.gapTheoryPP);
 const below0050=wealth?row.assets<row.benchmarkAssets-.005:row.gap0050PP< -1e-8;
 const theoryBehind=validTolerance&&row.gapTheoryPP< -tolerance-1e-8;
 $('comparison0050Alert').className='hint '+(below0050?'error':'good');
 $('comparison0050Alert').textContent=row.date+'：'+(below0050?'提醒：落後100%0050':'目前未落後100%0050')+'（'+(wealth?'相同金流資產':'報酬率')+'估算）。';
 const rateReminder=!validTolerance?'請設定有效的理論報酬提醒門檻。':theoryBehind?'提醒：每日複利報酬落後理論170% '+(-row.gapTheoryPP).toFixed(2)+' 個百分點，超過 '+tolerance+' 個百分點門檻。':'每日複利報酬對理論170%的落後未超過 '+tolerance+' 個百分點。';
 $('comparison170Alert').className='hint '+(!wealth&&theoryBehind?'error':'');
 $('comparison170Alert').textContent=wealth?'理論170%參考：同樣金流下，你的資產比理論曲線 '+(row.assets>=row.theoryAssets?'多 ':'少 ')+money(Math.abs(row.assets-row.theoryAssets))+'。':rateReminder;
 $('comparison170RateAlert').className='hint '+(theoryBehind?'error':'');$('comparison170RateAlert').textContent=rateReminder;
 $('comparisonDailySummary').textContent='逐日報酬複利：你的帳戶 '+pct(row.own)+'｜100%0050 '+pct(row.all0050)+'｜理論170% '+pct(row.theory)+'。這個百分比口徑與同金流的資產排名可能不同。';
 $('performanceAlert').textContent='落後提示是檢查策略的訊號；調整曝險金額請看下方帳戶設定。';
 $('performanceBasis').textContent=wealth?'6/1起始本金相同；你每次追加或轉出資金，0050與理論170%也在同一天投入或領走相同金額。主提醒比較最後留下的投資資產。':'同一天、同一起點比較你的「股票＋投資現金」與兩個基準。原有現金買股票不算新增本金；額外入金與轉出已排除於每日帳戶報酬之外。';
 $('comparisonDataStatus').textContent='比較截至 '+summary.end+' 收盤｜Excel帳戶日期 '+summary.workbookAsOf+'；持倉沿用最近儲存紀錄。Excel修改並儲存後，請重新匯入網站。持倉不會自動讀取電腦檔案。';
 $('comparisonEstimate').textContent='金流估算：現金不足日補入最低差額；其餘未明金流以儲存日現金餘額反推，共 '+inferredFlows.length+' 筆。你的曲線是重建估算。';
 $('comparisonUpdateError').textContent=summary.marketUpdateError??'';
 $('annualSnapshot').textContent='今年淨資產成長 '+(100*summary.yearNetGrowth).toFixed(2)+'%（Excel '+summary.workbookAsOf+'快照）';
 $('annualSnapshotDetails').textContent='年初淨資產 '+money(summary.yearStartNet)+'，快照淨資產 '+money(summary.currentNetSnapshot)+'。這是年初到快照日的淨資產成長，已扣貸款；主圖則從6/1比較投資帳戶報酬。';
 $('sameFlowNote').textContent=wealth?'三方使用相同入金、相同轉出日期與金額，比較最後留下多少資產。':'每日報酬複利比較各段績效；若你要比較相同加碼資金最後留下多少錢，可切換「同金流資產比較」。目前查看日，你的資產比同金流0050 '+(row.assets>=row.benchmarkAssets?'多 ':'少 ')+money(Math.abs(row.assets-row.benchmarkAssets))+'。';
 $('estimateFlowRows').innerHTML=inferredFlows.map(f=>'<tr><td>'+f.date+'</td><td>'+money(f.amount)+'</td><td>'+f.reason+'</td></tr>').join('');
 const W=Math.max(300,$('performanceChart').clientWidth),H=W<500?270:320,left=65,right=W-20,top=30,bottom=H-53;
 const keys=wealth?['assets','benchmarkAssets','theoryAssets']:['own','all0050','theory'],colors=['#b45309','#059669','#7c3aed'];
 const value=(r,k)=>wealth?r[k]/10000:100*(r[k]-1),values=selected.flatMap(r=>keys.map(k=>value(r,k)));
 let low=wealth?Math.min(...values):Math.min(0,...values),high=wealth?Math.max(...values):Math.max(0,...values),padding=Math.max(1,(high-low)*.12);low-=padding;high+=padding;
 const x=i=>selected.length===1?(left+right)/2:left+(right-left)*i/(selected.length-1),y=v=>bottom-(bottom-top)*(v-low)/(high-low);
 let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" style="width:100%;height:100%" aria-label="你的帳戶、100%0050與理論每日170%比較曲線">';
 for(let i=0;i<=4;i++){const v=low+(high-low)*i/4;svg+='<line x1="'+left+'" x2="'+right+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#e0e7f0"/><text x="'+(left-8)+'" y="'+(y(v)+5)+'" text-anchor="end" font-size="14" fill="#526175">'+v.toFixed(1)+(wealth?'萬':'%')+'</text>';}
 if(!wealth)svg+='<line x1="'+left+'" x2="'+right+'" y1="'+y(0)+'" y2="'+y(0)+'" stroke="#94a3b8" stroke-dasharray="4 4"/>';
 keys.forEach((key,n)=>{svg+='<polyline fill="none" stroke="'+colors[n]+'" stroke-width="3" points="'+selected.map((r,i)=>x(i).toFixed(2)+','+y(value(r,key)).toFixed(2)).join(' ')+'"/>';});
 for(let i=0;i<selected.length;i++){const r=selected[i];svg+='<circle cx="'+x(i)+'" cy="'+y(value(r,keys[0]))+'" r="8" opacity="0"><title>'+r.date+'｜你的帳戶 '+(wealth?money(r.assets):pct(r.own))+'｜0050 '+(wealth?money(r.benchmarkAssets):pct(r.all0050))+'｜理論170% '+(wealth?money(r.theoryAssets):pct(r.theory))+'</title></circle>';}
 const ticks=W<500?[0,selected.length-1]:[0,Math.floor((selected.length-1)/2),selected.length-1];for(const i of [...new Set(ticks)])svg+='<text x="'+x(i)+'" y="'+(bottom+29)+'" font-size="14" fill="#526175" text-anchor="'+(i===0?'start':i===selected.length-1?'end':'middle')+'">'+selected[i].date+'</text>';
 $('performanceChart').innerHTML=svg+'</svg>';
 if(lastError||summary.marketUpdateError)pauseAlerts(lastError||summary.marketUpdateError);
}
async function reload(){
 if(busy)return;busy=true;
 const oldMax=Number($('performanceDate').max),follow=Number($('performanceDate').value)===oldMax;
 try{
  const response=await request('/api/comparison');const data=await response.json();if(!response.ok||!Array.isArray(data.rows)||!data.rows.length)throw Error(data.error||'比較資料未取得');
  loaded=data;lastError=null;$('performanceDate').max=data.rows.length-1;if(follow||oldMax===0)$('performanceDate').value=data.rows.length-1;
  $('comparisonUpdateError').textContent='';render();
 }catch(e){
  lastError=e.message;pauseAlerts(lastError);
 }finally{busy=false;}
}
export async function mountPerformance(){
 try{const mode=localStorage.getItem(modeStorage);if(['rate','wealth'].includes(mode))$('comparisonMode').value=mode;const stored=localStorage.getItem('00631L-performance-tolerance');if(stored!==null&&stored.trim()!=='')$('performanceTolerance').value=stored;}catch{}
 $('comparisonMode').addEventListener('change',()=>{try{localStorage.setItem(modeStorage,$('comparisonMode').value);}catch{}render();});
 $('performanceDate').addEventListener('input',render);
 $('performanceTolerance').addEventListener('input',()=>{try{localStorage.setItem('00631L-performance-tolerance',$('performanceTolerance').value);}catch{}render();});
 $('refresh').addEventListener('click',reload);window.addEventListener('resize',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)reload();});
 setInterval(()=>{if(!document.hidden)reload();},60000);await reload();
}
