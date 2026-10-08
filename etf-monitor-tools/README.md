# 台股曝險與報酬比較

GitHub Pages靜態網站：比較私人正二＋現金帳戶、同金流100%0050，以及理論每日170%曝險。

網站無需啟動電腦上的服務。首次使用匯入私人帳戶備份，或填6/1起始投資現金後匯入Excel。Excel修改後需重新匯入。個人資料只存在瀏覽器的localStorage，不會上傳GitHub；換裝置請使用匯出備份。原始Excel不會被修改。清除網站資料會刪除本機帳戶，請先備份。

公開行情由GitHub Actions在台灣時間週一至週五14:20與16:20更新，執行時間可能延後。0050含息假設除息日收盤再投入；理論170%採臺灣50價格指數的每日1.7倍複利，忽略產品費用；帳戶曲線含成交紀錄費稅，外部金流未明部分仍為估算。報價為最後共同收盤，非盤中即時資料。公開來源失敗時顯示最後日期並暫停提醒。個人交易以最後一次匯入為準。

## 發布

1. 將本資料夾建立為GitHub repository，主分支為main。
2. 在Settings → Pages選擇GitHub Actions。
3. 執行Publish ETF comparison工作流程；成功後取得Pages網址。

只發布public資料夾。不要把私人備份、Excel、原本本機服務資料夾或帳戶CSV加入repository。一般GitHub Pages網址公開可讀，因此本版本不在發布內容內放入個人帳戶。

## 本機驗證

`node scripts/validate-public.mjs` 檢查發布檔案與私人資料排除。

`node scripts/update-market.mjs` 更新公開市場資料，不接觸個人帳戶。
