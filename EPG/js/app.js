// Global state
let dictionary = null; // Map string (title-en) to Object
let step1Data = null;
let step2Data = null;

// DOM Elements
const dropDict = document.getElementById('section-dict');
const channelSelect = document.getElementById('channel-select');
const statusDict = document.getElementById('status-dict');

const sectionStep1 = document.getElementById('section-step1');
const dropStep1 = document.getElementById('section-step1');
const fileStep1 = document.getElementById('file-step1');
const statusStep1 = document.getElementById('status-step1');

// Logs
const logStep1 = document.getElementById('log-step1');
const logPlaceholder = document.getElementById('log-placeholder');

const sectionStep2 = document.getElementById('section-step2');
const dropStep2 = document.getElementById('drop-step2');
const fileStep2 = document.getElementById('file-step2');
const btnProcessStep2 = document.getElementById('btn-process-step2');
const logStep2 = document.getElementById('log-step2');

function logInfo(container, msg) {
    logPlaceholder.classList.add('hidden');
    container.classList.add('has-content');
    const d = document.createElement('div');
    d.className = 'log-item info';
    d.innerText = `[INFO] ${msg}`;
    container.appendChild(d);
}

function logWarn(container, msg) {
    logPlaceholder.classList.add('hidden');
    container.classList.add('has-content');
    const d = document.createElement('div');
    d.className = 'log-item warn';
    d.innerText = `[WARN] ${msg}`;
    container.appendChild(d);
}

function logError(container, msg) {
    logPlaceholder.classList.add('hidden');
    container.classList.add('has-content');
    const d = document.createElement('div');
    d.className = 'log-item error';
    d.innerText = `[ERROR] ${msg}`;
    container.appendChild(d);
}

function clearLog(logArea) {
    logArea.innerHTML = '';
    logArea.classList.remove('has-content');
    logPlaceholder.classList.remove('hidden'); // Show placeholder when log is cleared
}

// Utility functions
function readExcelFile(fileOrBuffer, callback) {
    if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                // header: 1 means getting a 2D array of raw values
                // but for easier object-based processing, we use default or raw
                const json = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
                callback(null, json);
            } catch (error) {
                callback(error, null);
            }
        };
        reader.onerror = (error) => callback(error, null);
        reader.readAsArrayBuffer(fileOrBuffer);
    } else {
        // Assume ArrayBuffer from fetch
        try {
            const data = new Uint8Array(fileOrBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
            callback(null, json);
        } catch (error) {
            callback(error, null);
        }
    }
}

function getSafeString(val) {
    return val !== undefined && val !== null ? String(val).trim() : '';
}

// Format time string to HH:MM:SS
function formatTime(val) {
    if (!val) return '';
    // If it's already HH:MM:SS string, return it
    if (typeof val === 'string' && val.includes(':')) {
        let parts = val.split(':');
        if (parts.length >= 2) {
            let h = parts[0].padStart(2, '0');
            let m = parts[1].padStart(2, '0');
            let s = parts[2] ? parts[2].padStart(2, '0') : '00';
            return `${h}:${m}:${s}`;
        }
    }
    // If it's a date object
    if (val instanceof Date) {
        return val.toLocaleTimeString('en-GB'); // 24hr format
    }
    return getSafeString(val);
}

// Format date string to YYYY-MM-DD
function formatDate(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        // Assume it might be DD/MM/YYYY or YYYY-MM-DD
        let parts = val.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) { // YYYY-MM-DD
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) { // DD/MM/YYYY
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        return val;
    }
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return getSafeString(val);
}

function extractSeasonNumber(str) {
    // Looks for "Season 1", "S1", "S01", "Season 01"
    const regex = /S(?:eason\s*)?0*(\d+)/i;
    const match = str.match(regex);
    return match ? match[1] : '';
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // Increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // Increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// Computes similarity percentage between 0 and 1
function stringSimilarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    const longerLength = longer.length;
    if (longerLength === 0) {
        return 1.0; // Both are empty
    }
    const distance = levenshteinDistance(longer, shorter);
    const levSim = (longerLength - distance) / parseFloat(longerLength);

    // Character-based inclusion check (returns 1.0 if shorter is fully contained within longer, disregarding spaces/case)
    // To handle cases like "Jimmy Fallon S13" vs "Jimmy Fallon (S13)", we clean everything except letters and numbers
    const cleanLonger = longer.replace(/[^a-z0-9]/gi, '');
    const cleanShorter = shorter.replace(/[^a-z0-9]/gi, '');

    let charSim = 0;
    if (cleanShorter.length > 0 && cleanLonger.includes(cleanShorter)) {
        // Punish heavily if the difference in length is huge, e.g "The" matching "The Big Bang Theory" shouldn't instantly pass
        // But if user says "字元來比對", let's give it a high score if shorter is a substantial part (e.g. at least 50% length)
        if (cleanShorter.length / cleanLonger.length >= 0.5) {
            charSim = 0.96; // Give it a high enough score to pass the 95% threshold if it's a solid substring match
        }
    }

    // Check if the cleaned strings are exactly identical after removing punctuation 
    // e.g., "The Tonight Show Starring Jimmy Fallon S13" === "The Tonight Show Starring Jimmy Fallon (S13)"
    if (cleanLonger === cleanShorter) {
        charSim = 1.0;
    }

    return Math.max(levSim, charSim);
}

// Helper to export data to Excel
function exportExcel(data, filename) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
}

// Dictionary Persistence & Loading
let rawDictList = [];

function parseDictionaryData(data, channelId, isFromStorage = false) {
    dictionary = new Map();
    rawDictList = data;
    let validRows = 0;

    data.forEach((row, index) => {
        const enTitleRaw = row['節目英文名稱資料庫'] || row['節目英文名稱'];
        if (enTitleRaw) {
            const enTitle = String(enTitleRaw).trim().toLowerCase();
            dictionary.set(enTitle, {
                enTitleOriginal: String(enTitleRaw).trim(),
                zhTitle: getSafeString(row['節目中文譯名資料庫'] || row['節目中文譯名']),
                category: getSafeString(row['分類']),
                rating: getSafeString(row['節目分級'])
            });
            validRows++;
        }
    });

    if (validRows > 0) {
        if (isFromStorage) {
            statusDict.innerText = `✅ 已從雲端資料庫載入字典 (${validRows} 筆資料)`;
        } else {
            statusDict.innerText = `✅ 成功載入初始字典 (${validRows} 筆資料)`;
            // Wait to let caller save it if needed
        }

        // Enable Step 1
        document.getElementById('section-step1').classList.remove('disabled');
        fileStep1.disabled = false;
    } else {
        statusDict.innerText = `🔴 未找到有效資料。請確認欄位名稱。`;
    }
}

async function loadDictionaryForChannel(channelId) {
    if (!channelId) {
        statusDict.innerText = '請選擇欲轉換的頻道';
        document.getElementById('section-step1').classList.add('disabled');
        fileStep1.disabled = true;
        dictionary = null;
        return;
    }

    statusDict.innerText = '⏳ 正在連線至雲端資料庫載入字典...';

    try {
        // 1. Check Firebase first
        const docRef = db.collection('dictionaries').doc(channelId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            console.log("Found dictionary in Firebase");
            const cloudData = docSnap.data().data;
            parseDictionaryData(cloudData, channelId, true);
        } else {
            // 2. Not in Firebase, fallback to initial github excel file
            console.log("Not in Firebase, fetching initial seed...");
            statusDict.innerText = '⏳ 雲端無資料，正在載入系統初始字典...';
            const response = await fetch(`assets/dict/${channelId}.xlsx`);
            if (!response.ok) {
                throw new Error(`伺服器找不到該頻道初始字典 (${response.status})`);
            }
            const arrayBuffer = await response.arrayBuffer();

            readExcelFile(arrayBuffer, async (err, data) => {
                if (err) {
                    statusDict.innerHTML = `<span class="status-error">🔴 字典解析失敗: ${err.message}</span>`;
                    return;
                }

                // Parse and then upload seed directly back to Firebase
                parseDictionaryData(data, channelId, false);
                try {
                    statusDict.innerText = '⏳ 正在將初始字典同步至雲端...';
                    await docRef.set({ data: data });
                    console.log("Seed data uploaded to Firebase successfully");
                    statusDict.innerText = `✅ 成功載入並同步字典 (${data.length} 筆資料)`;
                } catch (e) {
                    console.error("Failed to upload seed to Firebase", e);
                }
            });
        }
    } catch (e) {
        console.error(e);
        statusDict.innerHTML = `<span class="status-error">🔴 讀取雲端字典失敗: ${e.message}</span>`;
    }
}

// Setup channel dropdown
channelSelect.addEventListener('change', (e) => {
    const channelId = e.target.value;
    loadDictionaryForChannel(channelId);
});

// Auto-load if previously selected
window.addEventListener('DOMContentLoaded', () => {
    if (channelSelect.value) {
        loadDictionaryForChannel(channelSelect.value);
    }
});

// Process Step 1 Core Logic
function processStep1Data(data, logElem) {
    const outData = [];
    let unmatchedCount = 0;

    data.forEach((row, i) => {
        // Raw Data extraction
        const exactDate = formatDate(row['Date'] || '');
        const exactTime = formatTime(row['Event Start Time'] || row['Start Time'] || '');
        const enTitleRaw = getSafeString(row['Title (English)'] || row['Title']);
        const searchTitle = enTitleRaw.toLowerCase();

        let zhTitle = '';
        let category = '影集'; // default
        let rating = '普'; // default

        // Finalizing output english title
        let finalEnTitle = enTitleRaw;

        if (dictionary.has(searchTitle)) {
            const dictEntry = dictionary.get(searchTitle);
            finalEnTitle = dictEntry.enTitleOriginal;
            zhTitle = dictEntry.zhTitle;
            category = dictEntry.category || category;
            rating = dictEntry.rating || rating;
        } else {
            // First, try to find a great fuzzy match for the ORIGINAL search string (to catch things like S13 vs (S13))
            let bestFullMatchKey = null;
            let highestFullSim = 0;
            const searchSeasonMatch = extractSeasonNumber(enTitleRaw);

            for (let dictKey of dictionary.keys()) {
                let sim = stringSimilarity(searchTitle, dictKey);

                // Prevent cross-season matching for full search
                const dictSeasonMatch = extractSeasonNumber(dictKey);
                if (searchSeasonMatch && dictSeasonMatch) {
                    if (searchSeasonMatch !== dictSeasonMatch) {
                        sim = 0; // Invalidate differing seasons
                    }
                }

                if (sim > highestFullSim) {
                    highestFullSim = sim;
                    bestFullMatchKey = dictKey;
                }
            }

            // If we have a very good match for the full string (e.g. > 0.85 to handle parentheses), use it
            if (highestFullSim >= 0.85 && bestFullMatchKey) {
                const dictEntry = dictionary.get(bestFullMatchKey);
                finalEnTitle = dictEntry.enTitleOriginal;
                zhTitle = dictEntry.zhTitle;
                category = dictEntry.category || category;
                rating = dictEntry.rating || rating;
                if (logElem) logInfo(logElem, `第 ${i + 2} 列高分比對成功: [${enTitleRaw}] ⮕ [${zhTitle}] (相似度: ${(highestFullSim * 100).toFixed(1)}%)`);
            } else {
                // If no good full match, fallback to stripping the season (base title)
                const baseTitleMatch = searchTitle.match(/^(.*?)(?:\s+(?:season|s\d+).*$|$)/i);
                const baseTitle = baseTitleMatch ? baseTitleMatch[1].trim() : searchTitle;

                if (dictionary.has(baseTitle)) {
                    const dictEntry = dictionary.get(baseTitle);
                    finalEnTitle = dictEntry.enTitleOriginal;
                    zhTitle = dictEntry.zhTitle;
                    category = dictEntry.category || category;
                    rating = dictEntry.rating || rating;
                    if (logElem) logInfo(logElem, `第 ${i + 2} 列去季數比對成功: [${enTitleRaw}] ⮕ [${zhTitle}]`);
                } else {
                    // Fuzzy matching as absolutely last resort for base title
                    let bestBaseMatchKey = null;
                    let highestBaseSim = 0;

                    for (let dictKey of dictionary.keys()) {
                        let sim = stringSimilarity(baseTitle, dictKey);
                        const dictSeasonMatch = extractSeasonNumber(dictKey);
                        if (searchSeasonMatch && dictSeasonMatch) {
                            if (searchSeasonMatch !== dictSeasonMatch) {
                                sim = 0;
                            }
                        }
                        if (sim > highestBaseSim) {
                            highestBaseSim = sim;
                            bestBaseMatchKey = dictKey;
                        }
                    }

                    if (highestBaseSim >= 0.95 && bestBaseMatchKey) {
                        const dictEntry = dictionary.get(bestBaseMatchKey);
                        finalEnTitle = dictEntry.enTitleOriginal;
                        zhTitle = dictEntry.zhTitle;
                        category = dictEntry.category || category;
                        rating = dictEntry.rating || rating;
                        if (logElem) logInfo(logElem, `第 ${i + 2} 列模糊/字元比對成功: [${enTitleRaw}] ⮕ [${zhTitle}] (相似度: ${(highestBaseSim * 100).toFixed(1)}%)`);
                    } else {
                        unmatchedCount++;
                        zhTitle = enTitleRaw; // Fallback to English title
                        if (logElem) logWarn(logElem, `第 ${i + 2} 列找不到翻譯: [${enTitleRaw}]，將採用原名。最佳相似度: ${(Math.max(highestFullSim, highestBaseSim) * 100).toFixed(1)}%`);
                    }
                }
            }
        }

        // Season & Episode extraction
        const sMatch = extractSeasonNumber(enTitleRaw);
        const epValRaw = getSafeString(row['Episode No.']);
        // Only keep numbers for EP
        const epVal = epValRaw.replace(/[^\d]/g, '');

        let seriesEpStr = '';
        if (sMatch && epVal) {
            seriesEpStr = `S${sMatch}E${epVal}`;
        } else if (epVal) {
            seriesEpStr = `E${epVal}`;
        }

        // Priority: 1. Translated Rating from Input, 2. Dictionary Rating, 3. Default '普'
        const rawRating = String(row['Parental Rating'] || '').trim().toUpperCase();
        let mappedRating = '';
        if (rawRating === 'PG') mappedRating = '護';
        else if (rawRating === 'PG12') mappedRating = '輔12';
        else if (rawRating === 'G') mappedRating = '普';
        else if (rawRating === '15') mappedRating = '輔15'; // Common guess, will only use if mapped
        else if (rawRating === 'R') mappedRating = '限'; // Common guess

        if (mappedRating) {
            rating = mappedRating; // Override dictionary if input has explicit mapped rating
        }

        // Check if subtitles exist based on (無字幕) in the Chinese title
        const hasNoSubtitles = zhTitle.includes('(無字幕)');
        const subtitleFlag = hasNoSubtitles ? 'N' : 'Y';

        const outRow = {
            'Date': exactDate,
            '開始日期': exactDate,
            'Start_Time': exactTime,
            '開始時間': exactTime,
            '英文片名': finalEnTitle,
            '中文片名': zhTitle,
            '內容分類/版型': category,
            '節目分級': rating,
            'Unnamed: 8': '',
            'S': sMatch,
            'Unnamed: 10': '',
            'E': epVal,
            'Unnamed: 12': '',
            '系列節目集數': seriesEpStr,
            'Subtitles': '',
            '字幕(Y|N)': subtitleFlag,
            '節目簡介(中)': getSafeString(row['Synopsis (Chinese)'] || ''),
            '節目簡介(英)': getSafeString(row['Synopsis (English)'] || ''),
            'Unnamed: 18': '',
            '節目簡介(單集簡介)': getSafeString(row['Synopsis (Chinese)'] || ''),
            'Unnamed: 20': '',
            '分級1': getSafeString(row['Parental Rating'] || ''),
            '分級': rating
        };
        outData.push(outRow);
    });

    if (unmatchedCount > 0) {
        logWarn(logElem, `比對完成。共有 ${unmatchedCount} 筆找不到翻譯，已保留原文。即將自動計算時間與轉換...`);
    } else {
        logInfo(logElem, `翻譯對應完成。所有節目皆成功對應！即將自動計算時間與轉換...`);
    }

    step1Data = outData;

    // Auto-trigger Processing and Downloading Step 3 format immediately
    logInfo(logElem, `開始生成平台檔案...`);
    setTimeout(() => {
        const platformData = processStep2Data(step1Data, logElem);
        exportExcel(platformData, `3-平台檔案(產生結果).xlsx`);
        logInfo(logElem, `所有轉換皆完成！檔案已自動下載。`);
    }, 1000);
}

// Process Step 2 Core Logic
function processStep2Data(data, logElem) {
    const outData = [];

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const nextRow = data[i + 1];

        const startDate = formatDate(row['開始日期'] || row['Date'] || '');
        let startTime = formatTime(row['開始時間'] || row['Start_Time'] || '');
        if (!startTime) startTime = '00:00:00';

        let endDate = startDate;
        let endTime = '';

        if (nextRow) {
            // End time is start time of next row
            endTime = formatTime(nextRow['開始時間'] || nextRow['Start_Time'] || '');
            const nextDate = formatDate(nextRow['開始日期'] || nextRow['Date'] || '');
            if (nextDate) endDate = nextDate;
        } else {
            // Last row, add 30 mins to start time as heuristic
            const dt = parseDateTime(startDate, startTime);
            if (dt && !isNaN(dt.getTime())) {
                dt.setMinutes(dt.getMinutes() + 30);
                endDate = formatDate(dt);
                endTime = formatTime(dt);
            } else {
                endTime = startTime; // Fallback
            }
        }

        const outRow = {
            '開始日期': startDate,
            '開始時間': startTime,
            '結束日期': endDate,
            '結束時間': endTime,
            '節目名稱': getSafeString(row['中文片名'] || row['英文片名']),
            '節目分級': getSafeString(row['節目分級'] || row['分級'] || '普'),
            '語言(Y|N)': 'N',
            '字幕(Y|N)': getSafeString(row['字幕(Y|N)'] || 'Y'),
            '多螢頻道(Y|N)': 'N',
            '內容分類/版型': getSafeString(row['內容分類/版型'] || '影集'),
            '系列節目集數': getSafeString(row['系列節目集數'] || ''),
            '節目簡介(單集簡介)': getSafeString(row['節目簡介(單集簡介)'] || row['節目簡介(中)'] || ''),
            '系列節目簡介': '',
            '導演-主持人': '',
            '演員-來賓': '',
            '系列節目註記': '',
            '英文片名': getSafeString(row['英文片名'] || ''),
            '是否推薦(Y|N)': '',
            '得獎紀錄': '',
            '關鍵字註記': '',
            '推薦文': '',
            '圖片檔名': '',
            '社群熱度': '',
            '年份': '',
            '回看(Y|N)': ''
        };
        outData.push(outRow);
    }

    if (logElem) logInfo(logElem, '時間計算與最終平台檔案轉換完成！');
    return outData;
}

// Setup Step 1 upload
fileStep1.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    dropStep1.querySelector('.drag-text').innerText = file.name;
    clearLog(logStep1);
    logInfo(logStep1, `開始讀取外片原檔...`);

    readExcelFile(file, (err, data) => {
        if (err) {
            logError(logStep1, `讀取失敗: ${err.message}`);
            return;
        }
        processStep1Data(data, logStep1);
    });
});

// Setup Step 2 upload (Optional manual path)
if (document.getElementById('file-step2')) {
    const fileStep2 = document.getElementById('file-step2');
    const dropStep2 = document.getElementById('section-step2');
    fileStep2.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (dropStep2) dropStep2.querySelector('.drag-text').innerText = file.name;

        const logStep2 = document.getElementById('log-step2');
        clearLog(logStep2);
        logInfo(logStep2, `開始讀取製作檔案...`);

        readExcelFile(file, (err, data) => {
            if (err) {
                logError(logStep2, `讀取失敗: ${err.message}`);
                return;
            }
            logInfo(logStep2, `讀取成功，開始轉換為平台檔案...`);
            const platformData = processStep2Data(data, logStep2);
            exportExcel(platformData, `3-平台檔案(自訂產生).xlsx`);
        });
    });
}

// Date addition helper logic for rolling over midnight
function parseDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const d = new Date(`${dateStr}T${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`);
    return d;
}

// ==========================================
// Settings Modal & Jspreadsheet Logic
// ==========================================
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnResetDict = document.getElementById('btn-reset-dict');
const spreadsheetContainer = document.getElementById('spreadsheet-container');

function closeSettings() {
    settingsModal.classList.add('hidden');
    if (window.mySpreadsheet) {
        window.mySpreadsheet.destroy();
        window.mySpreadsheet = null;
    }
}

btnSettings.addEventListener('click', () => {
    const channelId = channelSelect.value;
    if (!channelId) {
        alert("請先選擇頻道！");
        return;
    }

    document.getElementById('current-edit-channel').innerText = channelSelect.options[channelSelect.selectedIndex].text;
    settingsModal.classList.remove('hidden');

    const validData = Array.isArray(rawDictList) ? rawDictList : [];

    // Prepare data for Jspreadsheet
    const tableData = validData.map(row => [
        row['節目英文名稱資料庫'] || row['節目英文名稱'] || '',
        row['節目中文譯名資料庫'] || row['節目中文譯名'] || '',
        row['分類'] || '',
        row['節目分級'] || ''
    ]);

    // Ensure at least some empty rows for editing
    while (tableData.length < 100) {
        tableData.push(['', '', '', '']);
    }

    spreadsheetContainer.innerHTML = '';
    window.mySpreadsheet = jspreadsheet(spreadsheetContainer, {
        data: tableData,
        columns: [
            { type: 'text', title: '英文片名 (比對金鑰)', width: 300 },
            { type: 'text', title: '中文片名', width: 300 },
            { type: 'text', title: '分類', width: 120 },
            { type: 'text', title: '節目分級', width: 100 }
        ],
        search: true,
        pagination: 50,
        tableOverflow: false
    });
});

btnCloseSettings.addEventListener('click', closeSettings);
btnCancelSettings.addEventListener('click', closeSettings);

btnSaveSettings.addEventListener('click', async () => {
    if (!window.mySpreadsheet) return;
    const data = window.mySpreadsheet.getData();

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

    const channelId = channelSelect.value;

    // 1. Update active memory
    parseDictionaryData(newRawDictList, channelId, true);

    // 2. Upload to Firebase
    btnSaveSettings.disabled = true;
    btnSaveSettings.innerText = '上傳中...';
    try {
        await db.collection('dictionaries').doc(channelId).set({ data: newRawDictList });
        alert("✅ 字典已成功同步至 Firebase 雲端資料庫！所有人都能看到最新版本了！");
        closeSettings();
    } catch (e) {
        console.error("Firebase save failed", e);
        alert("儲存至雲端失敗：" + e.message);
    } finally {
        btnSaveSettings.disabled = false;
        btnSaveSettings.innerText = '儲存記憶';
    }
});

btnResetDict.addEventListener('click', async () => {
    if (confirm("確定要刪除雲端自訂字典，重新回到系統原始狀態嗎？這會影響所有使用者！")) {
        const channelId = channelSelect.value;
        const oldText = btnResetDict.innerText;
        btnResetDict.disabled = true;
        btnResetDict.innerText = '刪除中...';

        try {
            await db.collection('dictionaries').doc(channelId).delete();
            closeSettings();
            loadDictionaryForChannel(channelId);
            alert("雲端字典已成功重設。");
        } catch (e) {
            console.error(e);
            alert("重設失敗：" + e.message);
        } finally {
            btnResetDict.disabled = false;
            btnResetDict.innerText = oldText;
        }
    }
});
