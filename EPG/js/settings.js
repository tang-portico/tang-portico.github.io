// Elements
const channelSelect = document.getElementById('channel-settings-select');
const spreadsheetContainer = document.getElementById('spreadsheet-container');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnResetDict = document.getElementById('btn-reset-dict');
const statusText = document.getElementById('status-text');

let currentGrid = null;

// Fetch and Render
async function loadAndRenderDictionary(channelId) {
    if (!channelId) {
        if (currentGrid) {
            jspreadsheet.destroy(spreadsheetContainer);
            currentGrid = null;
        }
        statusText.innerText = "請先選擇頻道以載入字典。";
        return;
    }

    statusText.innerText = `⏳ 正在連線至 Firebase 載入 ${channelSelect.options[channelSelect.selectedIndex].text} 字典...`;

    try {
        const docRef = db.collection('dictionaries').doc(channelId);
        const docSnap = await docRef.get();

        let dataToRender = [];

        if (docSnap.exists) {
            dataToRender = docSnap.data().data;
            statusText.innerText = `✅ 從雲端成功載入 ${dataToRender.length} 筆翻譯。`;
        } else {
            statusText.innerText = '⏳ 雲端無資料，嘗試拉取系統初始字典庫備份...';
            // Fallback fetch
            const response = await fetch(`assets/dict/${channelId}.xlsx`);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                // We must use XLSX from SheetJS to parse the raw workbook to JSON
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                dataToRender = rawJson;

                // Save it back to firebase automatically
                await docRef.set({ data: rawJson });
                statusText.innerText = `✅ 初始字典庫 (${rawJson.length} 筆) 已自動同步至雲端。`;
            } else {
                throw new Error("找不到初始字典庫。");
            }
        }

        renderSpreadsheet(dataToRender);

    } catch (e) {
        console.error(e);
        statusText.innerText = `🔴 無法讀取資料: ${e.message}`;
    }
}

// Render the Jspreadsheet
function renderSpreadsheet(rawData) {
    if (currentGrid) {
        jspreadsheet.destroy(spreadsheetContainer);
        currentGrid = null;
        spreadsheetContainer.innerHTML = '';
    }

    // Map JSON objects to arrays for Jspreadsheet
    const tableData = rawData.map(row => [
        row['節目英文名稱資料庫'] || row['節目英文名稱'] || '',
        row['節目中文譯名資料庫'] || row['節目中文譯名'] || '',
        row['分類'] || '',
        row['節目分級'] || ''
    ]);

    // Ensure at least 50 empty rows for easy additions
    const emptyRowsToAdd = Math.max(0, 100 - tableData.length);
    for (let i = 0; i < emptyRowsToAdd; i++) {
        tableData.push(['', '', '', '']);
    }

    const spreadsheets = jspreadsheet(spreadsheetContainer, {
        worksheets: [{
            data: tableData,
            columns: [
                { type: 'text', title: '英文片名 (比對金鑰)', width: 300 },
                { type: 'text', title: '中文片名', width: 300 },
                { type: 'text', title: '分類', width: 120 },
                { type: 'text', title: '節目分級', width: 100 }
            ],
            search: true,
            pagination: 100,
            tableOverflow: true,
            tableWidth: "100%",
            tableHeight: "100%"
        }]
    });

    // v5 returns an array of worksheets
    currentGrid = spreadsheets[0];
}

// Save logic
btnSaveSettings.addEventListener('click', async () => {
    if (!currentGrid) return;
    const channelId = channelSelect.value;
    if (!channelId) return;

    const data = currentGrid.getData();
    const newRawDictList = data.map(row => ({
        '節目英文名稱資料庫': String(row[0]).trim(),
        '節目中文譯名資料庫': String(row[1]).trim(),
        '分類': String(row[2]).trim(),
        '節目分級': String(row[3]).trim()
    })).filter(row => row['節目英文名稱資料庫'] !== '');

    if (newRawDictList.length === 0) {
        alert("字典不能為空！");
        return;
    }

    const oldText = btnSaveSettings.innerText;
    btnSaveSettings.innerText = '上傳中...';
    btnSaveSettings.disabled = true;

    try {
        await db.collection('dictionaries').doc(channelId).set({ data: newRawDictList });
        alert("✅ 字典已成功同步至 Firebase 雲端資料庫！");
    } catch (e) {
        alert("儲存失敗：" + e.message);
    } finally {
        btnSaveSettings.innerText = oldText;
        btnSaveSettings.disabled = false;
    }
});

// Reset Logic
btnResetDict.addEventListener('click', async () => {
    const channelId = channelSelect.value;
    if (!channelId) return;

    if (confirm("確定要刪除雲端自訂字典，回到系統初始狀態嗎？這會清除所有手動更改！")) {
        const oldText = btnResetDict.innerText;
        btnResetDict.innerText = '刪除中...';
        btnResetDict.disabled = true;

        try {
            await db.collection('dictionaries').doc(channelId).delete();
            statusText.innerText = "雲端記憶已清除，正在重新拉取初始檔案...";
            await loadAndRenderDictionary(channelId);
            alert("✅ 重設成功。");
        } catch (e) {
            alert("重設失敗: " + e.message);
        } finally {
            btnResetDict.innerText = oldText;
            btnResetDict.disabled = false;
        }
    }
});

// Events
channelSelect.addEventListener('change', (e) => loadAndRenderDictionary(e.target.value));

// Init
window.addEventListener('DOMContentLoaded', () => {
    // If we want to auto-select a channel passed via URL query or default
    const urlParams = new URLSearchParams(window.location.search);
    const channelParam = urlParams.get('channel');
    if (channelParam) {
        channelSelect.value = channelParam;
        loadAndRenderDictionary(channelParam);
    }
});
