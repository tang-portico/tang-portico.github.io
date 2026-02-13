// --- Debug Logging ---
// function log(msg) {
//     const d = document.getElementById('debugLog');
//     if (d) {
//         d.innerHTML += `<div>${new Date().toISOString().split('T')[1].split('.')[0]} ${msg}</div>`;
//         d.scrollTop = d.scrollHeight;
//     }
//     console.log(msg);
// }

// --- Configuration ---
const SIZE_LANDSCAPE = { w: 1920, h: 1080, name: 'Horizontal' };
const SIZE_PORTRAIT = { w: 1080, h: 1350, name: 'Vertical' };

// --- State ---
// Updated Defaults based on user feedback
let globalSettings = {
    common: { copyrightText: "" },
    landscape: {
        logoScale: 54, // Default
        logoBottom: 0,
        gradHeight: 20, // Default
        gradOpacity: 0.6, // Default
        fontSize: 1.5 // Default
    },
    portrait: {
        logoScale: 80, // Default
        logoBottom: 2, // Default
        gradHeight: 20, // Default
        gradOpacity: 0.6, // Default
        fontSize: 1.5 // Default
    }
};

let state = {
    mode: 'landscape',
    logos: { cn: null, en: null },
    previewLang: 'cn', // 'cn' | 'en'
    sourceImages: [],
    items: { landscape: [], portrait: [] },
    activeItemId: null,
    seriesHistory: [] // Cache for history validation
};

// --- DOM Elements ---
const els = {
    logoInput: document.getElementById('logoInput'),
    imageInput: document.getElementById('imageInput'),
    seriesName: document.getElementById('seriesName'),
    seriesList: document.getElementById('seriesList'),
    episodeNumber: document.getElementById('episodeNumber'),
    editorContainer: document.getElementById('editorContainer'),
    tabs: document.querySelectorAll('.tab'),
    selectedCount: document.getElementById('selectedCount'),
    toggleSelectBtn: document.getElementById('toggleSelectBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    dlBtn: document.getElementById('dlBtn'),
    loading: document.getElementById('loadingOverlay'),
    progress: document.getElementById('progressText'),
    progressSub: document.getElementById('progressSub'),
    modeIndicator: document.getElementById('modeIndicator'),
    textModeLabel: document.getElementById('textModeLabel'),
    logoModeLabel: document.getElementById('logoModeLabel'),
    logoScale: document.getElementById('logoScale'),
    logoBottom: document.getElementById('logoBottom'),
    gradHeight: document.getElementById('gradHeight'),
    gradOpacity: document.getElementById('gradOpacity'),
    copyright: document.getElementById('copyrightText'),
    fontSize: document.getElementById('fontSizeScale'),
    logoScaleVal: document.getElementById('logoScaleVal'),
    logoBottomVal: document.getElementById('logoBottomVal'),
    gradHeightVal: document.getElementById('gradHeightVal'),
    gradOpacityVal: document.getElementById('gradOpacityVal'),
    fontSizeVal: document.getElementById('fontSizeVal'),
    officialTextControls: document.getElementById('officialTextControls'),
    itemTextColor: document.getElementById('itemTextColor'),
    itemTextShadow: document.getElementById('itemTextShadow'),
    selectedItemLabel: document.getElementById('selectedItemLabel'),
    groupLogoUpload: document.getElementById('groupLogoUpload'),
    groupLogoSettings: document.getElementById('groupLogoSettings')
};

// --- Usage Mode Switch ---
els.btnUsageSocial = document.getElementById('btnUsageSocial');
els.btnUsageOfficial = document.getElementById('btnUsageOfficial');
state.usageMode = 'social'; // 'social' | 'official'

els.btnUsageSocial.addEventListener('click', () => setUsageMode('social'));
els.btnUsageOfficial.addEventListener('click', () => setUsageMode('official'));

function setUsageMode(mode, persist = true) {
    state.usageMode = mode;
    if (persist) {
        localStorage.setItem('stills_last_usage_mode', mode); // Persist immediately
    }

    // Update Buttons
    if (mode === 'social') {
        els.btnUsageSocial.classList.add('active');
        els.btnUsageOfficial.classList.remove('active');
        // Show Portrait Tab
        document.querySelector('.tab[data-mode="portrait"]').style.display = 'block';
        document.querySelector('.tab[data-mode="portrait"]').style.visibility = 'visible';

        // Show Logo Controls
        if (els.groupLogoUpload) els.groupLogoUpload.style.display = 'block';
        if (els.groupLogoSettings) els.groupLogoSettings.style.display = 'block';
        const gradGroup = document.getElementById('groupGradientSettings');
        if (gradGroup) gradGroup.style.display = 'block';

        // Hide Official Controls
        if (els.officialTextControls) els.officialTextControls.style.display = 'none';

    } else {
        els.btnUsageOfficial.classList.add('active');
        els.btnUsageSocial.classList.remove('active');
        // Hide Portrait Tab
        document.querySelector('.tab[data-mode="portrait"]').style.display = 'none'; // effectively hides it

        // Hide Logo Controls
        if (els.groupLogoUpload) els.groupLogoUpload.style.display = 'none';
        if (els.groupLogoSettings) els.groupLogoSettings.style.display = 'none';
        const gradGroup = document.getElementById('groupGradientSettings');
        if (gradGroup) gradGroup.style.display = 'none';

        // Show Official Controls
        if (els.officialTextControls) els.officialTextControls.style.display = 'block';

        // If currently in portrait mode, switch to landscape
        if (state.mode === 'portrait') {
            document.querySelector('.tab[data-mode="landscape"]').click();
        }
    }
}

// --- Init & Listeners ---

els.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        els.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.mode = tab.dataset.mode;
        if (state.mode === 'portrait') els.editorContainer.classList.add('portrait-mode');
        else els.editorContainer.classList.remove('portrait-mode');
        updateSidebarInputs();
        renderGrid();
    });
});


// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.querySelector('.sidebar');
if (mobileMenuBtn) {
    // Initial state check
    if (window.innerWidth <= 900) {
        sidebar.classList.add('mobile-collapsed');
    }

    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-collapsed');
    });
}

function updateSidebarInputs() {
    const s = globalSettings[state.mode];
    els.logoScale.value = s.logoScale; els.logoScaleVal.innerText = s.logoScale + '%';
    els.logoBottom.value = s.logoBottom; els.logoBottomVal.innerText = s.logoBottom + '%';
    els.gradHeight.value = s.gradHeight; els.gradHeightVal.innerText = s.gradHeight + '%';
    els.gradOpacity.value = s.gradOpacity; els.gradOpacityVal.innerText = s.gradOpacity;
    els.fontSize.value = s.fontSize; els.fontSizeVal.innerText = s.fontSize;
    els.copyright.value = globalSettings.common.copyrightText;
    const modeName = state.mode === 'landscape' ? '橫式' : '直式';
    els.modeIndicator.innerText = `目前設定模式：${modeName}`;
    els.modeIndicator.className = `mode-indicator active-${state.mode}`;
    els.textModeLabel.innerText = modeName;
    els.logoModeLabel.innerText = modeName;
    // Updated to "Download All" as requested
    els.dlBtn.innerHTML = `<span>⬇</span> 下載全部`;
    updateUI();
}

// Initialize inputs for default mode (landscape) on load
updateSidebarInputs();

els.copyright.addEventListener('input', (e) => {
    globalSettings.common.copyrightText = e.target.value;
    // Save immediately when copyright text is updated
    saveSettings();
    redrawAllCanvases();
});

const independentInputs = {
    'logoScale': 'logoScale', 'logoBottom': 'logoBottom',
    'gradHeight': 'gradHeight', 'gradOpacity': 'gradOpacity',
    'fontSizeScale': 'fontSize'
};

// --- Official Mode Sidebar Controls ---
// Bind listeners to the sidebar controls to update the Active Item
if (els.itemTextColor) {
    els.itemTextColor.addEventListener('input', (e) => {
        if (!state.activeItemId) return;
        const list = state.items[state.mode];
        const item = list.find(x => x.id === state.activeItemId);
        if (item) {
            if (!item.textStyle) item.textStyle = { color: '#ffffff', shadow: true };
            item.textStyle.color = e.target.value;
            // Find and redraw the canvas for this specific item
            const canvas = els.editorContainer.querySelector(`canvas[data-item-id="${item.id}"]`);
            if (canvas) {
                const source = state.sourceImages.find(s => s.id === item.sourceId);
                if (source) drawCanvas(canvas, item, source, 0.25);
            }
        }
    });
}

if (els.itemTextShadow) {
    els.itemTextShadow.addEventListener('change', (e) => {
        if (!state.activeItemId) return;
        const list = state.items[state.mode];
        const item = list.find(x => x.id === state.activeItemId);
        if (item) {
            if (!item.textStyle) item.textStyle = { color: '#ffffff', shadow: true };
            item.textStyle.shadow = e.target.checked;
            // Find and redraw the canvas for this specific item
            const canvas = els.editorContainer.querySelector(`canvas[data-item-id="${item.id}"]`);
            if (canvas) {
                const source = state.sourceImages.find(s => s.id === item.sourceId);
                if (source) drawCanvas(canvas, item, source, 0.25);
            }
        }
    });
}

Object.keys(independentInputs).forEach(domId => {
    const el = document.getElementById(domId);
    const settingKey = independentInputs[domId];
    el.addEventListener('input', (e) => {
        globalSettings[state.mode][settingKey] = e.target.value;
        // Special case: fontSizeScale's display element is fontSizeVal (not fontSizeScaleVal)
        const valDisplayId = domId === 'fontSizeScale' ? 'fontSizeVal' : domId + 'Val';
        const valDisplay = document.getElementById(valDisplayId);
        if (valDisplay) {
            let suffix = (settingKey === 'gradOpacity' || settingKey === 'fontSize') ? '' : '%';
            valDisplay.innerText = e.target.value + suffix;
        }
        redrawAllCanvases();
    });
});

// --- Logo Handling ---

const btnLangCN = document.getElementById('btnLangCN');
const btnLangEN = document.getElementById('btnLangEN');
const logoStatus = document.getElementById('logoStatus');

btnLangCN.addEventListener('click', () => setPreviewLang('cn'));
btnLangEN.addEventListener('click', () => setPreviewLang('en'));

function setPreviewLang(lang) {
    state.previewLang = lang;
    if (lang === 'cn') {
        btnLangCN.classList.add('active');
        btnLangEN.classList.remove('active');
    } else {
        btnLangEN.classList.add('active');
        btnLangCN.classList.remove('active');
    }
    redrawAllCanvases();
}

els.logoInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Reset logos
    state.logos = { cn: null, en: null };
    let loadedCount = 0;

    const checkDone = () => {
        loadedCount++;
        if (loadedCount === files.length) {
            updateLogoStatus();
            redrawAllCanvases();
        }
    };

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                // Detection Logic
                // 1. Check for Explicit English keywords or 'en' with boundaries
                const name = file.name.toLowerCase();

                // Regex for "en" as a distinct word or component (start/end/separator)
                // Matches: "logo_en.png", "en-logo.png", "logo-en.png", "logo (en).png", "english", "eng", "英"
                const isEnglish = /(^|[^a-z])en([^a-z]|$)|eng|english|英/.test(name);

                if (isEnglish) {
                    state.logos.en = img;
                    state.logos.en.filename = file.name;
                } else {
                    // Default to Chinese for everything else (or explicit 'cn', 'cht', '中')
                    state.logos.cn = img;
                    state.logos.cn.filename = file.name;
                }
                checkDone();
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    });
});

function updateLogoStatus() {
    let text = "";
    if (state.logos.cn) text += `✅ TW: ${state.logos.cn.filename}<br>`;
    else text += `⬜ TW: 未上傳<br>`;

    if (state.logos.en) text += `✅ EN: ${state.logos.en.filename}`;
    else text += `⬜ EN: 未上傳`;

    logoStatus.innerHTML = text;
    document.getElementById('logoLabel').innerText = `已載入 ${Object.values(state.logos).filter(x => x).length} 個 Logo`;
}


async function processFiles(files) {
    if (files.length === 0) return;

    els.loading.style.display = 'flex';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue; // Skip non-images

        els.progress.innerText = `正在載入 ${i + 1}/${files.length}`;
        els.progressSub.innerText = "SmartCrop 快速分析中...";

        const imgObj = await loadImage(file);
        const sourceId = 'src_' + Date.now() + Math.random();

        // Always use SmartCrop now
        const analysisL = await analyzeSmartCropOnly(imgObj, SIZE_LANDSCAPE.w, SIZE_LANDSCAPE.h);
        const analysisP = await analyzeSmartCropOnly(imgObj, SIZE_PORTRAIT.w, SIZE_PORTRAIT.h);

        // 2. Create Source
        state.sourceImages.push({
            id: sourceId,
            file: file,
            imgObj: imgObj,
            adjustments: { brightness: 100, contrast: 100, saturation: 100 }
        });

        // 3. Create Items
        const lConfig = createConfigFromAI(imgObj, SIZE_LANDSCAPE, analysisL.crop);
        state.items.landscape.push({
            id: 'item_' + Date.now() + Math.random() + '_l',
            sourceId: sourceId,
            cropConfig: lConfig,
            selected: true,
            textStyle: { color: '#ffffff', shadow: true }
        });

        const pConfig = createConfigFromAI(imgObj, SIZE_PORTRAIT, analysisP.crop);
        state.items.portrait.push({
            id: 'item_' + Date.now() + Math.random() + '_p',
            sourceId: sourceId,
            cropConfig: pConfig,
            selected: true,
            textStyle: { color: '#ffffff', shadow: true }
        });
    }

    updateUI();
    renderGrid();
    els.loading.style.display = 'none';
    // Reset input value to allow selecting same files again if needed
    els.imageInput.value = '';
}

els.imageInput.addEventListener('change', (e) => {
    processFiles(Array.from(e.target.files));
});

// Drag & Drop Support
document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Optional: Add visual feedback
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        processFiles(files);
    }
});


els.toggleSelectBtn.addEventListener('click', () => {
    if (state.images && state.images.length === 0) return; // Wait, original code accessed state.images?? No, state.items.
    // Check old code logic: 
    // const hasUnselected = state.images.some... WRONG. state.images doesn't exist in original snippet.
    // It should be state.items[state.mode]?
    // Let's fix this obvious bug from previous code if it existed, or just keep it correct.
    const currentList = state.items[state.mode];
    if (currentList.length === 0) return;
    const hasUnselected = currentList.some(img => !img.selected);
    currentList.forEach(img => img.selected = hasUnselected);
    updateUI();
    renderGrid();
});

// --- SmartCrop Only Wrapper ---
async function analyzeSmartCropOnly(img, targetW, targetH) {
    try {
        const result = await smartcrop.crop(img, { width: targetW, height: targetH });
        return { type: 'smart', crop: result.topCrop };
    } catch (err) {
        return { type: 'none', crop: null };
    }
}

function createConfigFromAI(imgObj, targetSize, cropData) {
    const ratioSrc = imgObj.width / imgObj.height;
    const ratioTarget = targetSize.w / targetSize.h;
    let baseScale;

    if (ratioSrc > ratioTarget) baseScale = targetSize.h / imgObj.height;
    else baseScale = targetSize.w / imgObj.width;

    const config = {
        baseScale: baseScale, userScale: 1.0,
        origW: imgObj.width, origH: imgObj.height, x: 0, y: 0,
        aiDetected: !!cropData
    };

    if (cropData) {
        // cropData is {x, y, width, height} (Top-Left based)
        // Calculate center of the crop area (Face Group or SmartCrop)
        const cropCenterX = cropData.x + (cropData.width / 2);
        const cropCenterY = cropData.y + (cropData.height / 2);

        // We want this center point to be at the center of our canvas
        // Formula: CanvasCenter - (ImageCenter * Scale)
        config.x = (targetSize.w / 2) - (cropCenterX * baseScale);
        config.y = (targetSize.h / 2) - (cropCenterY * baseScale);
    } else {
        // Default center
        const scaledW = imgObj.width * baseScale;
        const scaledH = imgObj.height * baseScale;
        config.x = (targetSize.w - scaledW) / 2;
        config.y = (targetSize.h - scaledH) / 2;
    }

    recalculateBounds(config, targetSize.w, targetSize.h, false);
    return config;
}

function recalculateBounds(config, targetW, targetH, forceCenter = false) {
    const totalScale = config.baseScale * config.userScale;
    config.currentW = config.origW * totalScale;
    config.currentH = config.origH * totalScale;
    config.minX = targetW - config.currentW;
    config.minY = targetH - config.currentH;

    if (!forceCenter) {
        if (config.x < config.minX) config.x = config.minX;
        if (config.y < config.minY) config.y = config.minY;
        if (config.x > 0) config.x = 0;
        if (config.y > 0) config.y = 0;
    } else {
        config.x = (targetW - config.currentW) / 2;
        config.y = (targetH - config.currentH) / 2;
    }
}

// --- Rendering ---

function updateUI() {
    const currentList = state.items[state.mode];
    const selectedCount = currentList.filter(item => item.selected).length;
    els.selectedCount.innerText = selectedCount;
    // Enable download if there are ANY items
    els.dlBtn.disabled = currentList.length === 0;
    els.toggleSelectBtn.disabled = currentList.length === 0;
}

function renderGrid() {
    els.editorContainer.innerHTML = '';
    if (state.items[state.mode].length === 0) {
        els.editorContainer.innerHTML = `<div class="empty-state"><h2>尚未載入劇照</h2><p>請從左側上傳圖片</p></div>`;
        return;
    }

    const targetSize = state.mode === 'landscape' ? SIZE_LANDSCAPE : SIZE_PORTRAIT;

    state.items[state.mode].forEach((item) => {
        const source = state.sourceImages.find(s => s.id === item.sourceId);
        if (!source) return;

        const card = document.createElement('div');
        const isActive = state.activeItemId === item.id;
        card.className = `edit-card ${item.selected ? 'selected' : 'unselected'} ${isActive ? 'active-item' : ''}`;
        card.style.borderColor = isActive ? 'var(--accent-color)' : (item.selected ? '#555' : '#333');
        if (isActive) card.style.boxShadow = '0 0 0 2px var(--accent-color)';

        // Click to set active
        card.addEventListener('click', () => setActiveItem(item));

        // Tools Overlay
        const tools = document.createElement('div');
        tools.className = 'card-tools';

        const cbWrapper = document.createElement('div');
        cbWrapper.className = `checkbox-wrapper ${item.selected ? 'active' : ''}`;
        cbWrapper.innerHTML = `<div class="custom-checkbox"></div>`;
        cbWrapper.onclick = (e) => { e.stopPropagation(); toggleImageSelection(item.id); };
        tools.appendChild(cbWrapper);

        const toolsRight = document.createElement('div');
        toolsRight.className = 'tools-right';

        const dupBtn = document.createElement('div');
        dupBtn.className = 'icon-btn';
        dupBtn.innerHTML = '❐';
        dupBtn.title = "複製";
        dupBtn.onclick = (e) => { e.stopPropagation(); duplicateImage(item.id); };
        toolsRight.appendChild(dupBtn);

        const delBtn = document.createElement('div');
        delBtn.className = 'icon-btn delete-btn';
        delBtn.innerHTML = '✕';
        delBtn.onclick = (e) => { e.stopPropagation(); removeImage(item.id); };
        toolsRight.appendChild(delBtn);

        tools.appendChild(toolsRight);
        card.appendChild(tools);

        // Canvas
        const wrapper = document.createElement('div');
        wrapper.className = 'canvas-wrapper';

        const previewScale = 0.25;
        const uiW = targetSize.w * previewScale;
        const uiH = targetSize.h * previewScale;

        const canvas = document.createElement('canvas');
        canvas.width = uiW;
        canvas.height = uiH;
        canvas.dataset.itemId = item.id;

        setupDrag(canvas, item, previewScale);
        wrapper.appendChild(canvas);

        wrapper.appendChild(canvas);

        // Controls (Zoom & Filters)
        const controls = document.createElement('div');
        controls.className = 'card-controls';

        const row1 = document.createElement('div');
        row1.className = 'control-row';
        row1.innerHTML = `<div class="control-label">🔍 縮放</div>`;
        const zoomInput = document.createElement('input');
        zoomInput.type = 'range'; zoomInput.min = '1'; zoomInput.max = '3'; zoomInput.step = '0.01'; zoomInput.value = item.cropConfig.userScale;
        zoomInput.addEventListener('input', (e) => {
            item.cropConfig.userScale = parseFloat(e.target.value);
            recalculateBounds(item.cropConfig, targetSize.w, targetSize.h, false);
            drawCanvas(canvas, item, source, previewScale);
        });
        row1.appendChild(zoomInput);

        const colorBtn = document.createElement('div');
        colorBtn.className = 'color-btn';
        colorBtn.innerHTML = `🎨 調色`;
        colorBtn.onclick = (e) => {
            e.stopPropagation();
            const panel = controls.querySelector('.filter-panel');
            panel.classList.toggle('show');
            colorBtn.classList.toggle('active');
        };
        row1.appendChild(colorBtn);
        controls.appendChild(row1);

        const filters = document.createElement('div');
        filters.className = 'filter-panel';

        const createFilterSlider = (label, key, icon) => {
            const row = document.createElement('div');
            row.className = 'control-row';
            row.style.marginBottom = '5px';
            row.innerHTML = `<div class="control-label">${icon} ${label}</div>`;
            const input = document.createElement('input');
            input.type = 'range'; input.min = '0'; input.max = '200'; input.step = '1'; input.value = source.adjustments[key];
            input.addEventListener('input', (e) => {
                source.adjustments[key] = parseInt(e.target.value);
                redrawAllUsingSource(source.id);
            });
            row.appendChild(input);
            return row;
        };

        filters.appendChild(createFilterSlider('亮度', 'brightness', '☀'));
        filters.appendChild(createFilterSlider('對比', 'contrast', '◑'));
        filters.appendChild(createFilterSlider('飽和', 'saturation', '🍭'));
        controls.appendChild(filters);

        // Info
        const info = document.createElement('div');
        info.className = 'card-info';
        info.innerText = source.file.name;

        card.appendChild(wrapper);
        card.appendChild(controls);
        card.appendChild(info);
        els.editorContainer.appendChild(card);

        drawCanvas(canvas, item, source, previewScale);
    });
}

// --- Actions ---

function toggleImageSelection(itemId) {
    const list = state.items[state.mode];
    const item = list.find(x => x.id === itemId);
    if (item) {
        item.selected = !item.selected;
        updateUI();
        renderGrid();
    }
}

function removeImage(itemId) {
    if (confirm('確定要移除這張劇照嗎？')) {
        state.items[state.mode] = state.items[state.mode].filter(x => x.id !== itemId);
        updateUI();
        renderGrid();
    }
}

function duplicateImage(itemId) {
    const list = state.items[state.mode];
    const index = list.findIndex(x => x.id === itemId);
    if (index === -1) return;
    const originalItem = list[index];
    const newItem = {
        id: 'item_' + Date.now() + Math.random(),
        sourceId: originalItem.sourceId,
        cropConfig: { ...originalItem.cropConfig },
        selected: originalItem.selected
    };
    list.splice(index + 1, 0, newItem);
    updateUI();
    renderGrid();
}

function setActiveItem(item) {
    state.activeItemId = item.id;

    // Update Sidebar Controls
    if (els.selectedItemLabel) {
        const source = state.sourceImages.find(s => s.id === item.sourceId);
        els.selectedItemLabel.innerText = source ? `調整中: ${source.file.name}` : '單張調整 (已選取)';
    }

    if (els.itemTextColor && els.itemTextShadow) {
        // Initialize style if missing
        if (!item.textStyle) item.textStyle = { color: '#ffffff', shadow: true };

        els.itemTextColor.value = item.textStyle.color;
        els.itemTextShadow.checked = item.textStyle.shadow;
    }

    renderGrid(); // To show highlight border with 'active-item' class
}

function setupDrag(canvas, item, uiScale) {
    let isDragging = false;
    let startX, startY, initialImgX, initialImgY;
    const onMouseDown = (e) => {
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        initialImgX = item.cropConfig.x;
        initialImgY = item.cropConfig.y;
        canvas.parentElement.style.cursor = 'grabbing';
    };
    const onMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const visualScaleX = canvas.width / rect.width;
        const visualScaleY = canvas.height / rect.height;
        const deltaX = (e.clientX - startX) * visualScaleX * 1.2;
        const deltaY = (e.clientY - startY) * visualScaleY * 1.2;
        let newX = initialImgX + deltaX; let newY = initialImgY + deltaY;
        const config = item.cropConfig;
        if (newX > 0) newX = 0;
        if (newX < config.minX) newX = config.minX;
        if (newY > 0) newY = 0;
        if (newY < config.minY) newY = config.minY;
        config.x = newX; config.y = newY;
        const source = state.sourceImages.find(s => s.id === item.sourceId);
        if (source) drawCanvas(canvas, item, source, uiScale);
    };
    const onMouseUp = () => { isDragging = false; canvas.parentElement.style.cursor = 'grab'; };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

// Clear All Button
els.clearAllBtn.addEventListener('click', () => {
    if (confirm('確定要刪除所有劇照嗎？(無法復原)')) {
        state.sourceImages = [];
        state.items.landscape = [];
        state.items.portrait = [];
        state.activeItemId = null;
        updateUI();
        renderGrid();

        // Clear file input so same files can be re-uploaded if needed
        els.imageInput.value = '';
    }
});

function redrawAllUsingSource(sourceId) {
    const canvases = els.editorContainer.querySelectorAll('canvas');
    canvases.forEach(cvs => {
        const itemId = cvs.dataset.itemId;
        const list = state.items[state.mode];
        const item = list.find(x => x.id === itemId);
        if (item && item.sourceId === sourceId) {
            const source = state.sourceImages.find(s => s.id === sourceId);
            drawCanvas(cvs, item, source, 0.25);
        }
    });
}

function redrawAllCanvases() {
    const canvases = els.editorContainer.querySelectorAll('canvas');
    canvases.forEach(cvs => {
        const itemId = cvs.dataset.itemId;
        const list = state.items[state.mode];
        const item = list.find(x => x.id === itemId);
        if (item) {
            const source = state.sourceImages.find(s => s.id === item.sourceId);
            if (source) drawCanvas(cvs, item, source, 0.25);
        }
    });
}

function drawCanvas(canvas, item, source, scaleFactor) {
    const ctx = canvas.getContext('2d');
    const targetW = canvas.width;
    const targetH = canvas.height;
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

    const config = item.cropConfig;
    const settings = globalSettings[state.mode];
    const sharedText = globalSettings.common.copyrightText;

    ctx.save();
    const adj = source.adjustments;
    if (adj) {
        ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`;
    }
    ctx.drawImage(source.imgObj, config.x * scaleFactor, config.y * scaleFactor, config.currentW * scaleFactor, config.currentH * scaleFactor);
    ctx.restore();

    const gHeightPercent = parseInt(settings.gradHeight) / 100;
    // Official Mode: No Gradient
    if (state.usageMode !== 'official' && gHeightPercent > 0) {
        const gHeight = targetH * gHeightPercent;
        const opacity = settings.gradOpacity;
        const gradient = ctx.createLinearGradient(0, targetH - gHeight, 0, targetH);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, `rgba(0,0,0,${opacity})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, targetH - gHeight, targetW, gHeight);
    }

    const currentLogo = state.logos[state.previewLang];

    if (currentLogo) {
        const logoScaleP = parseInt(settings.logoScale) / 100;
        const logoBottomP = parseInt(settings.logoBottom) / 100;
        const drawLogoW = targetW * logoScaleP;
        const drawLogoH = drawLogoW * (currentLogo.height / currentLogo.width);
        const logoX = (targetW - drawLogoW) / 2;
        const logoY = targetH - drawLogoH - (targetH * logoBottomP);
        ctx.drawImage(currentLogo, logoX, logoY, drawLogoW, drawLogoH);
    }


    // Official Mode: Render per-item text with custom color/shadow
    if (state.usageMode === 'official') {
        const copyrightText = globalSettings.common.copyrightText;
        if (copyrightText) {
            // Initialize textStyle if missing
            if (!item.textStyle) item.textStyle = { color: '#ffffff', shadow: true };

            const fontSizeBase = targetH * 0.012;
            const fontSize = fontSizeBase * parseFloat(settings.fontSize);
            ctx.font = `${fontSize}px "Helvetica Neue", Arial, sans-serif`;
            ctx.fillStyle = item.textStyle.color;
            ctx.textAlign = "right";
            ctx.textBaseline = "bottom";

            if (item.textStyle.shadow) {
                ctx.shadowColor = "rgba(0,0,0,0.8)";
                ctx.shadowBlur = 2;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
            } else {
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }

            const marginX = targetW * 0.02;
            const marginY = targetH * 0.015;
            ctx.fillText(copyrightText, targetW - marginX, targetH - marginY);
        }
    } else if (sharedText) {
        // Social Mode: Shared copyright text
        const fontSizeBase = targetH * 0.012;
        const fontSize = fontSizeBase * parseFloat(settings.fontSize);
        ctx.font = `${fontSize}px "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.textAlign = "right"; ctx.textBaseline = "bottom";
        ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 2; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
        const marginX = targetW * 0.02; const marginY = targetH * 0.015;
        ctx.fillText(sharedText, targetW - marginX, targetH - marginY);
    }

}

function loadImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function drawHighRes(item, mode) {
    const size = mode === 'landscape' ? SIZE_LANDSCAPE : SIZE_PORTRAIT;
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const source = state.sourceImages.find(s => s.id === item.sourceId);
    drawCanvas(canvas, item, source, 1);
    return canvas;
}

els.dlBtn.addEventListener('click', () => {
    // Manual Save on Download
    saveSettings();

    const originalMode = state.mode;
    const originalLang = state.previewLang;
    const activeId = state.activeItemId; // Start tracking active item

    const itemsToDownload = {
        landscape: state.items.landscape,
        portrait: state.items.portrait
    };

    // Check if any items exist at all
    if (itemsToDownload.landscape.length === 0 && itemsToDownload.portrait.length === 0) {
        alert("目前沒有劇照可供下載");
        return;
    }

    els.loading.style.display = 'flex';

    const zip = new JSZip();
    const sName = els.seriesName.value.trim();
    let epNum = els.episodeNumber.value.trim();

    // Auto-format Episode Number: "1" -> "EP01"
    if (epNum && /^\d+$/.test(epNum)) {
        epNum = 'EP' + epNum.padStart(2, '0');
    }

    const prefixInput = (sName && epNum) ? `${sName}_${epNum}` : (sName || epNum);

    // Official Mode: Only landscape, no language variants, no subfolders
    if (state.usageMode === 'official') {
        els.progressSub.innerText = "正在產生官網專用檔案...";

        const list = itemsToDownload.landscape;
        if (list.length === 0) {
            alert("目前沒有橫式劇照可供下載");
            els.loading.style.display = 'none';
            return;
        }

        (async () => {
            try {
                // Set to landscape mode for rendering
                state.mode = 'landscape';

                for (let i = 0; i < list.length; i++) {
                    const item = list[i];
                    const source = state.sourceImages.find(s => s.id === item.sourceId);

                    els.progress.innerText = `正在處理 ${i + 1}/${list.length} (${Math.round((i + 1) / list.length * 100)}%)`;

                    const canvas = drawHighRes(item, 'landscape');
                    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));

                    let filename;
                    if (prefixInput) {
                        const seq = (i + 1).toString().padStart(3, '0');
                        filename = `${prefixInput}_${seq}.jpg`;
                    } else {
                        // Find siblings to determine version suffix
                        const siblings = list.filter(it => {
                            const s = state.sourceImages.find(src => src.id === it.sourceId);
                            return s.file.name === source.file.name;
                        });

                        let copySuffix = "";
                        if (siblings.length > 1) {
                            const copyIndex = siblings.indexOf(item) + 1;
                            copySuffix = `_v${copyIndex}`;
                        }
                        filename = source.file.name.replace(/\.[^/.]+$/, "") + copySuffix + ".jpg";
                    }

                    // Add directly to zip root, no subfolder
                    zip.file(filename, blob);
                }

                els.progress.innerText = "打包壓縮中...";
                const zipName = prefixInput ? `${prefixInput}_Official.zip` : `Official_Stills.zip`;
                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, zipName);

            } catch (err) {
                console.error(err);
                alert("下載過程發生錯誤: " + err.message);
            } finally {
                // Restore Original State
                state.mode = originalMode;
                state.previewLang = originalLang;
                state.activeItemId = activeId;
                els.loading.style.display = 'none';

                // Force re-render to restore UI appearance
                updateUI();
                renderGrid();
            }
        })();
        return;
    }

    // Social Mode: Full multi-language, multi-orientation export
    els.progressSub.innerText = "正在產生全語言與尺寸檔案...";

    // Languages to generate
    const languages = ['cn', 'en'];
    const modes = ['landscape', 'portrait'];

    let totalTasks = 0;
    languages.forEach(lang => {
        modes.forEach(mode => {
            totalTasks += itemsToDownload[mode].length;
        });
    });
    let completedTasks = 0;

    (async () => {
        try {
            for (const lang of languages) {
                // Set Language State
                state.previewLang = lang;

                for (const mode of modes) {
                    // Set Mode State (important for drawCanvas logic depending on state.mode/settings)
                    state.mode = mode;

                    const list = itemsToDownload[mode];
                    if (list.length === 0) continue;

                    // Create Folder: e.g. "橫_中_landscape"
                    const langStr = lang === 'cn' ? '中' : '英';
                    const modePrefix = mode === 'landscape' ? '橫' : '直';
                    const modeSuffix = mode === 'landscape' ? '_landscape' : '_portrait';
                    const folderName = `${modePrefix}_${langStr}${modeSuffix}`;
                    const folder = zip.folder(folderName);

                    for (let i = 0; i < list.length; i++) {
                        const item = list[i];
                        const source = state.sourceImages.find(s => s.id === item.sourceId);

                        completedTasks++;
                        const langLabel = lang === 'cn' ? 'TW' : 'EN';
                        els.progress.innerText = `[${langLabel}-${mode}] 正在處理 ${i + 1}/${list.length} (總進度 ${Math.round(completedTasks / totalTasks * 100)}%)`;

                        // Force drawHighRes to use current state settings
                        const canvas = drawHighRes(item, mode);
                        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));

                        const seq = (i + 1).toString().padStart(3, '0');
                        let filename;
                        if (prefixInput) {
                            filename = `${prefixInput}_${modePrefix}_${langStr}_${seq}.jpg`;
                        } else {
                            filename = `${modePrefix}_${langStr}_${seq}.jpg`;
                        }

                        folder.file(filename, blob);
                    }
                }
            }

            els.progress.innerText = "打包壓縮中...";
            const zipName = prefixInput ? `${prefixInput}_Global_Pack.zip` : `Watermarked_Global_Pack.zip`;
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, zipName);

        } catch (err) {
            console.error(err);
            alert("下載過程發生錯誤: " + err.message);
        } finally {
            // Restore Original State
            state.mode = originalMode;
            state.previewLang = originalLang;
            state.activeItemId = activeId;
            els.loading.style.display = 'none';

            // Force re-render to restore UI appearance
            updateUI();
            renderGrid();
        }
    })();
});
// --- Persistence ---

const STORAGE_PREFIX = 'stills_settings_';

function getStorageKey() {
    const seriesCode = els.seriesName.value.trim();
    return seriesCode ? STORAGE_PREFIX + seriesCode : STORAGE_PREFIX + 'default';
}

function saveSettings() {
    const key = getStorageKey();
    const data = {
        globalSettings: globalSettings,
        usageMode: state.usageMode,
        aiEngine: state.aiEngine
    };
    try {
        localStorage.setItem(key, JSON.stringify(data));

        // Also save series name to history
        const sName = els.seriesName.value.trim();
        if (sName) {
            saveSeriesHistory(sName);
        }
    } catch (e) {
        console.warn("Storage full or error", e);
    }
}

// --- Series History ---
const SERIES_HISTORY_KEY = 'stills_series_history';

function loadSeriesHistory() {
    try {
        const history = JSON.parse(localStorage.getItem(SERIES_HISTORY_KEY) || '[]');
        state.seriesHistory = history; // Cache it

        els.seriesList.innerHTML = '';
        history.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            els.seriesList.appendChild(option);
        });
    } catch (e) {
        console.error("Error loading series history", e);
    }
}

function saveSeriesHistory(name) {
    try {
        let history = JSON.parse(localStorage.getItem(SERIES_HISTORY_KEY) || '[]');
        // Remove existing to re-add at top (or just ensure unique)
        history = history.filter(n => n !== name);
        history.unshift(name); // Add to top
        // Limit history size? Say 20 items
        if (history.length > 20) history = history.slice(0, 20);

        localStorage.setItem(SERIES_HISTORY_KEY, JSON.stringify(history));
        loadSeriesHistory(); // Refresh datalist
    } catch (e) {
        console.error("Error saving series history", e);
    }
}

function loadSettings() {
    const key = getStorageKey();
    const raw = localStorage.getItem(key);
    const hasSeriesName = els.seriesName.value.trim() !== '';

    if (raw) {
        try {
            const data = JSON.parse(raw);

            // 1. Restore Global Settings
            // Merge carefully to avoid obliterating structure if we add new keys later
            if (data.globalSettings) {
                // Only restore copyright text if we have a series name
                if (hasSeriesName && data.globalSettings.common) {
                    globalSettings.common = { ...globalSettings.common, ...data.globalSettings.common };
                }
                globalSettings.landscape = { ...globalSettings.landscape, ...data.globalSettings.landscape };
                globalSettings.portrait = { ...globalSettings.portrait, ...data.globalSettings.portrait };
            }

            // 2. Restore Usage Mode
            if (data.usageMode) {
                // Do NOT persist this change to history, as it's just loading defaults/specifics
                setUsageMode(data.usageMode, false);
            }

            // 3. Restore AI Engine
            if (data.aiEngine) {
                setEngine(data.aiEngine);
            }

            // 4. Update Inputs to match new settings (refresh UI)
            updateSidebarInputs();

            // 5. Redraw everything with new settings
            redrawAllCanvases();

            // console.log('Loaded settings from', key);
        } catch (e) {
            console.warn('Failed to parse settings', e);
        }
    } else {
        // console.log('No settings found for', key, 'using current defaults');
        // Optional: If switching to a new series code that has no data, 
        // do we reset to absolute defaults? 
        // For now, let's keep current state (which might be the previous series settings)
        // effectively acting as "Carry over settings to new series", which is usually preferred UX.
        // If "Reset to factory" is needed, we'd need a reset function.
    }
}

// Bind Load/Save Triggers for Filename Prefix
// Note: Auto-save removed per user request. Saving only happens on Download.
// Bind Load/Save Triggers for Series Name
// Note: Auto-save removed per user request. Saving only happens on Download.
els.seriesName.addEventListener('blur', () => {
    // When leaving the field, we load the settings for that new code
    loadSettings();
});
els.seriesName.addEventListener('change', () => {
    // Catch datalist selection (Change covers blur/enter/click in some browsers)
    loadSettings();
});
els.seriesName.addEventListener('input', (e) => {
    // Immediate load if matches known history (better UX for dropdown)
    const val = e.target.value.trim();
    if (state.seriesHistory.includes(val)) {
        loadSettings();
    }
});
els.seriesName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        els.seriesName.blur(); // Trigger blur logic
    }
});
els.episodeNumber.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        els.episodeNumber.blur();
    }
});

// Initial Load
loadSeriesHistory();
loadSettings();

// Restore Last Used Mode (Global preference overrides default settings on load)
setTimeout(() => {
    const lastMode = localStorage.getItem('stills_last_usage_mode');
    if (lastMode) {
        setUsageMode(lastMode); // Default persist=true is fine here, confirms the choice
    }
}, 50);

// --- Add Missing Listener for Copyright ---
els.copyright.addEventListener('input', (e) => {
    globalSettings.common.copyrightText = e.target.value;
    // Debounce save? Or rely on download?
    // User requested "Save on Download". But we must update state.
});
