const canvasFontFamilyChi = '"source-han-sans-cjk-tc", sans-serif';
const canvasFontFamilyEn = '"normalidad-compact", sans-serif';

// DOM Elements
const videoInput = document.getElementById('videoInput');
const video = document.getElementById('mainVideo');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');
const countDisplay = document.getElementById('countDisplay');
const emptyState = document.getElementById('emptyState');
const dropMessage = document.getElementById('dropMessage');
const intervalRange = document.getElementById('intervalRange');
const intervalInput = document.getElementById('intervalTime');
const intervalDisplay = document.getElementById('intervalDisplay');
const aiToggle = document.getElementById('aiToggle');
const modelSelect = document.getElementById('modelSelect');
const modelStatus = document.getElementById('modelStatus');
const ctx = canvas.getContext('2d');

// Panels
const videoPanel = document.getElementById('videoPanel');
const galleryPanel = document.getElementById('galleryPanel');
const editorPanel = document.getElementById('editorPanel');

// Header Controls
const fileUploadContainer = document.getElementById('fileUploadContainer');
const backToCaptureBtn = document.getElementById('backToCaptureBtn');
const step1Badge = document.getElementById('step1-badge');
const step2Badge = document.getElementById('step2-badge');

// Editor Canvases
const canvasChi = document.getElementById('canvasChi');
const ctxChi = canvasChi.getContext('2d');
const canvasEn = document.getElementById('canvasEn');
const ctxEn = canvasEn.getContext('2d');

// Inputs
const titleChi = document.getElementById('titleChi');
const titleEn = document.getElementById('titleEn');
const editEp = document.getElementById('editEp');
const editCopyright = document.getElementById('editCopyright');
const isSpinoff = document.getElementById('isSpinoff');
const epInputGroup = document.getElementById('epInputGroup');

let currentEditImage = null;
let templates = { chi: new Image(), en: new Image() };

// Image Transform State
let imgTransform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };

// Load templates
templates.chi.crossOrigin = "anonymous";
templates.chi.src = "img/YT_temp_Chi.png";
templates.en.crossOrigin = "anonymous";
templates.en.src = "img/YT_temp_en.png";

let isAutoCapturing = false;
let captureCount = 0;
let aiModelLoaded = false;
let loadedModels = { ssd: false, tiny: false };

function switchMode(mode) {
    if (mode === 'edit') {
        videoPanel.classList.add('hidden');
        fileUploadContainer.classList.add('hidden');
        backToCaptureBtn.classList.remove('hidden');
        galleryPanel.classList.remove('lg:w-5/12');
        galleryPanel.classList.add('lg:w-4/12');
        editorPanel.classList.remove('hidden');
        step1Badge.classList.remove('text-blue-400', 'font-bold');
        step1Badge.classList.add('text-gray-500');
        step2Badge.classList.remove('text-gray-500');
        step2Badge.classList.add('text-blue-400', 'font-bold');
    } else {
        editorPanel.classList.add('hidden');
        galleryPanel.classList.remove('lg:w-4/12');
        galleryPanel.classList.add('lg:w-5/12');
        videoPanel.classList.remove('hidden');
        fileUploadContainer.classList.remove('hidden');
        backToCaptureBtn.classList.add('hidden');
        step1Badge.classList.add('text-blue-400', 'font-bold');
        step1Badge.classList.remove('text-gray-500');
        step2Badge.classList.add('text-gray-500');
        step2Badge.classList.remove('text-blue-400', 'font-bold');
    }
}

function openEditor(imageUrl) {
    currentEditImage = new Image();
    currentEditImage.onload = () => {
        canvasChi.width = 1920; canvasChi.height = 1080;
        canvasEn.width = 1920; canvasEn.height = 1080;

        // Init transform to cover
        resetImageTransform();

        updateThumbnails();
        switchMode('edit');
    };
    currentEditImage.src = imageUrl;
}

// --- Interaction Logic (Pan & Zoom) ---
function resetImageTransform() {
    if (!currentEditImage) return;
    const w = 1920, h = 1080;
    const imgRatio = currentEditImage.width / currentEditImage.height;
    const canvasRatio = w / h;

    // Calculate scale to "Cover"
    let scale;
    if (imgRatio > canvasRatio) scale = h / currentEditImage.height;
    else scale = w / currentEditImage.width;

    imgTransform = { x: 0, y: 0, scale: scale }; // Centered logic is handled in draw
    updateThumbnails();
}

function setupCanvasInteraction(canvasEl) {
    canvasEl.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', (e) => {
        if (!isDragging || !currentEditImage) return;
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        lastMousePos = { x: e.clientX, y: e.clientY };

        // Adjust sensitivity relative to canvas display size
        const rect = canvasEl.getBoundingClientRect();
        const scaleFactor = 1920 / rect.width;

        imgTransform.x += dx * scaleFactor;
        imgTransform.y += dy * scaleFactor;
        updateThumbnails();
    });
    canvasEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomIntensity = 0.001;
        const newScale = Math.max(0.1, imgTransform.scale + e.deltaY * -zoomIntensity * imgTransform.scale); // Zoom based on current scale
        imgTransform.scale = newScale;
        updateThumbnails();
    }, { passive: false });
}

setupCanvasInteraction(canvasChi);
setupCanvasInteraction(canvasEn);


// Live Updates
[titleChi, titleEn, editEp, editCopyright, isSpinoff].forEach(el => {
    el.addEventListener('input', updateThumbnails);
    el.addEventListener('change', updateThumbnails);
});

function updateThumbnails() {
    if (!currentEditImage) return;

    if (isSpinoff.checked) {
        editEp.disabled = true;
        epInputGroup.style.opacity = '0.3';
    } else {
        editEp.disabled = false;
        epInputGroup.style.opacity = '1';
    }

    drawSingleThumbnail(ctxChi, templates.chi, titleChi.value, 115, 660, 648, 'chi');
    drawSingleThumbnail(ctxEn, templates.en, titleEn.value, 115, 660, 648, 'en');
}

function drawSingleThumbnail(ctx, template, titleText, x, bottomY, maxWidth, lang) {
    const w = 1920;
    const h = 1080;

    // Clear with BLACK base (Fix for transparency)
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, w, h);

    // 0. Smart Blur Fill (Background Layer)
    // Draw a blurred, darkened, zoomed-in version of the image to fill gaps
    ctx.save();
    ctx.filter = 'blur(40px) brightness(0.6)';
    // Draw image to cover canvas fully
    const fillRatio = Math.max(w / currentEditImage.width, h / currentEditImage.height);
    const fillW = currentEditImage.width * fillRatio;
    const fillH = currentEditImage.height * fillRatio;
    ctx.drawImage(currentEditImage, (w - fillW) / 2, (h - fillH) / 2, fillW, fillH);
    ctx.restore();

    // 1. Draw User Transformed Image
    ctx.save();
    // Move to center, apply transform, move back
    ctx.translate(w / 2 + imgTransform.x, h / 2 + imgTransform.y);
    ctx.scale(imgTransform.scale, imgTransform.scale);
    ctx.drawImage(currentEditImage, -currentEditImage.width / 2, -currentEditImage.height / 2);
    ctx.restore();

    // 2. Template Overlay
    if (template && template.complete) {
        ctx.drawImage(template, 0, 0, w, h);
    }

    // 3. Text
    if (titleText) {
        ctx.fillStyle = "white";
        // Stroke setup
        ctx.strokeStyle = "black";
        ctx.lineWidth = 4;

        let fontSize;
        let lineHeight;
        let letterSpacing = "0px";
        let fontFamily;
        let fontWeight;

        if (lang === 'en') {
            fontSize = 79; // 79pt
            lineHeight = 102; // 102pt
            fontFamily = canvasFontFamilyEn;
            fontWeight = 500;
        } else {
            fontSize = 80; // 80pt
            lineHeight = 105; // Adjusted for 80pt
            letterSpacing = "0px";
            fontFamily = canvasFontFamilyChi;
            fontWeight = 700;
        }

        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

        // Using ctx.letterSpacing (Supported in Chrome 94+, Firefox 103+, Safari 15.4+)
        if ('letterSpacing' in ctx) {
            ctx.letterSpacing = letterSpacing;
        }

        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        const lines = titleText.split('\n');

        for (let i = lines.length - 1; i >= 0; i--) {
            let yPos = bottomY - ((lines.length - 1 - i) * lineHeight);
            ctx.strokeText(lines[i], x, yPos); // Draw Stroke
            ctx.fillText(lines[i], x, yPos);   // Draw Fill
        }

        // Reset letterSpacing
        if ('letterSpacing' in ctx) {
            ctx.letterSpacing = "0px";
        }
    }

    // 4. Badge Logic
    let badgeText = "";
    let badgeColor = "#ff7349";

    if (isSpinoff.checked) {
        badgeText = (lang === 'chi') ? "番外篇" : "SPIN-OFF";
    } else if (editEp.value.trim()) {
        badgeText = "EP" + editEp.value.trim();
    }

    if (badgeText) {
        let badgeFont = canvasFontFamilyEn;
        if (isSpinoff.checked && lang === 'chi') {
            badgeFont = canvasFontFamilyChi;
        }

        ctx.font = `700 95px ${badgeFont}`;
        const textMetrics = ctx.measureText(badgeText);

        const paddingX = 35;
        const paddingY = 35;
        const fixedHeight = 137;
        let badgeW = Math.max(255, textMetrics.width + (paddingX * 2));

        const rightMargin = 25;
        const badgeX = w - rightMargin - badgeW;
        const badgeY = 20;

        ctx.fillStyle = "white";
        roundRect(ctx, badgeX, badgeY, badgeW, fixedHeight, 32.5, true, false);

        ctx.fillStyle = badgeColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";

        const badgeMetrics = ctx.measureText(badgeText);
        const textY = badgeY + (fixedHeight / 2) + (badgeMetrics.actualBoundingBoxAscent - badgeMetrics.actualBoundingBoxDescent) / 2;

        ctx.fillText(badgeText, badgeX + (badgeW / 2), textY);
    }

    // 5. Copyright
    if (editCopyright.value.trim()) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
        ctx.font = `bold 18px ${canvasFontFamilyChi}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 50;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillText(editCopyright.value.trim(), w - 30, h - 60);
        ctx.restore();
    }
}

function downloadLink(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadAll() {
    const nameChi = `Cover_Chi_${(titleChi.value || 'Untitled').replace(/\n/g, '')}_EP${editEp.value}.jpg`;
    downloadLink(canvasChi.toDataURL('image/jpeg', 0.95), nameChi);

    setTimeout(() => {
        const nameEn = `Cover_En_${(titleEn.value || 'Untitled').replace(/\n/g, '')}_EP${editEp.value}.jpg`;
        downloadLink(canvasEn.toDataURL('image/jpeg', 0.95), nameEn);
    }, 500);
}

// --- Standard Helpers ---
function showMessage(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const div = document.createElement('div');
    let bgClass = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600';
    div.className = `toast-notification ${bgClass} text-white px-4 py-2 rounded-lg shadow-lg mb-2 flex items-center gap-2 text-sm font-medium`;
    div.innerHTML = `<span>${msg}</span>`;
    container.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; div.style.transform = 'translate(-50%, -20px)'; setTimeout(() => div.remove(), 300); }, 3000);
}

function secondsToHHMMSS(sec) {
    sec = Number(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec % 3600 / 60);
    const s = Math.floor(sec % 3600 % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseHHMMSStoSeconds(str) {
    const parts = str.split(':').map(part => parseFloat(part));
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 1) seconds = parts[0];
    return isNaN(seconds) ? 0 : seconds;
}

function formatFilenameTime(seconds) { return new Date(seconds * 1000).toISOString().substr(11, 8).replace(/:/g, '-'); }

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') stroke = true;
    if (typeof radius === 'undefined') radius = 5;
    if (typeof radius === 'number') radius = { tl: radius, tr: radius, br: radius, bl: radius };
    else { var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 }; for (var side in defaultRadius) { radius[side] = radius[side] || defaultRadius[side]; } }
    ctx.beginPath(); ctx.moveTo(x + radius.tl, y); ctx.lineTo(x + width - radius.tr, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr); ctx.lineTo(x + width, y + height - radius.br); ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height); ctx.lineTo(x + radius.bl, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl); ctx.lineTo(x, y + radius.tl); ctx.quadraticCurveTo(x, y, x + radius.tl, y); ctx.closePath(); if (fill) ctx.fill(); if (stroke) ctx.stroke();
}

// --- Listeners ---
intervalRange.addEventListener('input', (e) => { intervalDisplay.innerText = parseFloat(e.target.value).toFixed(1); intervalInput.value = e.target.value; });
['startTime', 'endTime'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('blur', () => { el.value = secondsToHHMMSS(parseHHMMSStoSeconds(el.value)); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); });
});
videoInput.addEventListener('change', (e) => loadVideo(e.target.files[0]));
document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadVideo(e.dataTransfer.files[0]); });

function loadVideo(file) {
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
        const dur = secondsToHHMMSS(video.duration);
        document.getElementById('videoDuration').innerText = dur;
        document.getElementById('endTime').value = dur;
        dropMessage.classList.add('hidden');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        showMessage('影片載入成功', 'success');
    };
}
function setCurrentTime(type) { document.getElementById(type === 'start' ? 'startTime' : 'endTime').value = secondsToHHMMSS(video.currentTime); }

// --- AI ---
async function loadSelectedModel() {
    const type = modelSelect.value;
    if (loadedModels[type]) return true;
    modelStatus.innerText = "載入中..."; modelStatus.className = "text-[10px] text-yellow-500 animate-pulse";
    try {
        const path = 'models';
        if (type === 'ssd') await faceapi.nets.ssdMobilenetv1.loadFromUri(path);
        else await faceapi.nets.tinyFaceDetector.loadFromUri(path);
        loadedModels[type] = true;
        modelStatus.innerText = "就緒"; modelStatus.className = "text-[10px] text-green-500 font-bold";
        return true;
    } catch (e) { console.error(e); modelStatus.innerText = "失敗"; modelStatus.className = "text-[10px] text-red-500"; showMessage("模型載入失敗", 'error'); aiToggle.checked = false; return false; }
}
aiToggle.addEventListener('change', async (e) => { if (e.target.checked) await loadSelectedModel(); else { modelStatus.innerText = "已停用"; modelStatus.className = "text-[10px] text-gray-500"; } });
modelSelect.addEventListener('change', async () => { if (aiToggle.checked) await loadSelectedModel(); });

// --- Capture ---
async function captureFrame(isAuto = false) {
    if (!video.videoWidth) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const timestamp = video.currentTime;
    const item = createGalleryItem(dataUrl, timestamp);
    gallery.insertBefore(item, gallery.firstChild);

    if (isAuto && aiToggle.checked) {
        const type = modelSelect.value;
        if (!loadedModels[type]) await loadSelectedModel();
        if (loadedModels[type]) {
            const badge = item.querySelector('.ai-status');
            badge.innerHTML = '⏳';
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 320; tempCanvas.height = 240;
            tempCanvas.getContext('2d').drawImage(canvas, 0, 0, 320, 240);
            try {
                let detections = [];
                if (type === 'ssd') detections = await faceapi.detectAllFaces(tempCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }));
                else detections = await faceapi.detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }));
                if (detections.length > 0) {
                    badge.innerHTML = '👤'; badge.className = "ai-status absolute top-2 right-2 bg-green-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg z-10";
                    item.classList.add('ring-2', 'ring-green-500');
                } else {
                    badge.innerHTML = '❌'; badge.className = "ai-status absolute top-2 right-2 bg-gray-600/50 text-white text-[10px] px-2 py-0.5 rounded-full z-10 opacity-50";
                    item.classList.add('no-face-dimmed');
                }
            } catch (e) { badge.innerHTML = '⚠️'; }
        }
    } else {
        const badge = item.querySelector('.ai-status'); if (badge) badge.remove();
    }
}

function createGalleryItem(dataUrl, timestamp) {
    if (captureCount === 0) emptyState.classList.add('hidden');
    captureCount++; countDisplay.innerText = captureCount;
    const fileName = `Capture_${formatFilenameTime(timestamp)}.jpg`;
    const div = document.createElement('div');
    div.className = "gallery-item w-full bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md flex flex-col animate-fadeIn transition-all duration-300";
    div.innerHTML = `
        <div class="relative w-full aspect-video bg-black group cursor-pointer overflow-hidden" onclick="viewImage('${dataUrl}')">
            <img src="${dataUrl}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
            <div class="ai-status absolute top-2 right-2 bg-blue-500/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm z-10 hidden">AI</div>
            <div class="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded font-mono border border-white/10 z-10">${secondsToHHMMSS(timestamp)}</div>
        </div>
        <div class="p-3 bg-gray-800 flex justify-between items-center border-t border-gray-700">
            <span class="text-xs text-gray-400 font-mono truncate mr-2 w-20">${fileName}</span>
            <div class="flex gap-1">
                <button onclick="openEditor('${dataUrl}')" class="text-yellow-400 hover:text-white hover:bg-yellow-600 p-1.5 rounded transition" title="製作封面"><span class="text-xs font-bold">🎨 製作封面</span></button>
                <a href="${dataUrl}" download="${fileName}" class="text-blue-400 hover:text-white hover:bg-blue-600 p-1.5 rounded transition" title="下載"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></a>
            </div>
        </div>`;
    if (aiToggle.checked) div.querySelector('.ai-status').classList.remove('hidden');
    return div;
}

function viewImage(url) {
    const win = window.open();
    win.document.write(`<body style="margin:0;background:#0f0f12;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden;"><img src="${url}" style="max-width:95%;max-height:95%;box-shadow:0 0 50px rgba(0,0,0,0.8);border-radius:8px;border:1px solid #333;"></body>`);
}

let clearTimer;
function clearGallery() {
    if (captureCount === 0) return;
    const btn = document.getElementById('btnClear');
    if (btn.getAttribute('data-confirm') !== 'true') {
        btn.innerText = '確定刪除？'; btn.setAttribute('data-confirm', 'true'); btn.classList.add('bg-red-600', 'text-white'); btn.classList.remove('text-red-400', 'hover:bg-red-400/10');
        clearTimer = setTimeout(() => { resetClearButton(btn); }, 3000); return;
    }
    const items = gallery.querySelectorAll('.gallery-item'); items.forEach(item => item.remove());
    captureCount = 0; countDisplay.innerText = 0; emptyState.classList.remove('hidden');
    showMessage('畫廊已清空', 'success'); resetClearButton(btn); if (clearTimer) clearTimeout(clearTimer);
}

function resetClearButton(btn) { btn.innerText = '清空'; btn.removeAttribute('data-confirm'); btn.classList.remove('bg-red-600', 'text-white'); btn.classList.add('text-red-400', 'hover:bg-red-400/10'); }

document.getElementById('btnManualCapture').addEventListener('click', () => { if (!video.src) { showMessage('請先載入影片！', 'warning'); return; } captureFrame(); });
const seekTo = (time) => new Promise(resolve => { const onSeeked = () => { video.removeEventListener('seeked', onSeeked); setTimeout(resolve, 150); }; video.addEventListener('seeked', onSeeked); video.currentTime = time; });
document.getElementById('btnAutoCapture').addEventListener('click', async () => {
    if (!video.src) { showMessage('請先載入影片！', 'warning'); return; }
    if (isAutoCapturing) return;
    const start = parseHHMMSStoSeconds(document.getElementById('startTime').value);
    const end = parseHHMMSStoSeconds(document.getElementById('endTime').value);
    const interval = parseFloat(intervalInput.value);
    if (start >= end) { showMessage('時間錯誤', 'error'); return; }

    if (aiToggle.checked) { const loaded = await loadSelectedModel(); if (!loaded) return; }

    isAutoCapturing = true; const btn = document.getElementById('btnAutoCapture'); const originalHTML = btn.innerHTML;
    btn.innerHTML = `停止`; btn.classList.replace('bg-emerald-600', 'bg-red-600'); video.pause(); showMessage('開始截圖...', 'info');
    try {
        for (let t = start; t <= end; t += interval) { await seekTo(t); await captureFrame(true); document.getElementById('galleryContainer').scrollTop = 0; }
    } catch (err) { console.error(err); }
    finally { isAutoCapturing = false; btn.innerHTML = originalHTML; btn.classList.replace('bg-red-600', 'bg-emerald-600'); showMessage('截圖完成', 'success'); }
});


// --- Persistence ---
function saveSettings() {
    const settings = {
        interval: intervalInput.value,
        aiEnabled: aiToggle.checked,
        aiModel: modelSelect.value,
        titleChi: titleChi.value,
        titleEn: titleEn.value,
        episode: editEp.value,
        copyright: editCopyright.value,
        isSpinoff: isSpinoff.checked
    };
    localStorage.setItem('highlight_settings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('highlight_settings');
    if (saved) {
        try {
            const s = JSON.parse(saved);
            if (s.interval) {
                intervalInput.value = s.interval;
                intervalRange.value = s.interval;
                intervalDisplay.innerText = parseFloat(s.interval).toFixed(1);
            }
            if (s.aiEnabled !== undefined) {
                aiToggle.checked = s.aiEnabled;
                // If AI was enabled, we need to load model or update UI status
                if (s.aiEnabled) {
                    modelStatus.innerText = "等待啟用"; modelStatus.className = "text-[10px] text-gray-500";
                    // We don't auto-load model on page load to save resources/time, 
                    // but we reflect the checkbox state. 
                    // Or we could trigger load if user wants. For now just set check.
                }
            }
            if (s.aiModel) modelSelect.value = s.aiModel;
            if (s.titleChi) titleChi.value = s.titleChi;
            if (s.titleEn) titleEn.value = s.titleEn;
            if (s.episode) editEp.value = s.episode;
            if (s.copyright) editCopyright.value = s.copyright;
            if (s.isSpinoff !== undefined) isSpinoff.checked = s.isSpinoff;

            updateThumbnails(); // Redraw with loaded text
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    }
}

// Auto-save listeners
const inputsToSave = [intervalRange, aiToggle, modelSelect, titleChi, titleEn, editEp, editCopyright, isSpinoff];
inputsToSave.forEach(el => {
    el.addEventListener('change', saveSettings);
    el.addEventListener('input', saveSettings);
});

// Load on init
loadSettings();

