const PACKAGE_URL = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";
const MODEL_DATA_URL = "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/";
const MAX_AI_DIMENSION = 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const uploadBtn = document.getElementById("uploadBtn");
const uploadBox = document.getElementById("uploadBox");
const processing = document.getElementById("processing");
const resultSection = document.getElementById("resultSection");
const sideBySideView = document.getElementById("sideBySideView");
const sliderView = document.getElementById("sliderView");
const resultStage = document.getElementById("resultStage");
const sliderStage = document.getElementById("sliderStage");
const originalImage = document.getElementById("originalImage");
const resultImage = document.getElementById("resultImage");
const sliderBeforeImage = document.getElementById("sliderBeforeImage");
const sliderAfterImage = document.getElementById("sliderAfterImage");
const sliderBeforeClip = document.getElementById("sliderBeforeClip");
const sliderDivider = document.getElementById("sliderDivider");
const compareRange = document.getElementById("compareRange");
const originalMeta = document.getElementById("originalMeta");
const resultMeta = document.getElementById("resultMeta");
const processingText = document.getElementById("processingText");
const processingSub = document.getElementById("processingSub");
const statusText = document.getElementById("statusText");
const statusDot = document.querySelector(".status-dot");
const noticeBanner = document.getElementById("noticeBanner");
const downloadBtn = document.getElementById("downloadBtn");
const newBtn = document.getElementById("newBtn");
const sampleBadgeBtn = document.getElementById("sampleBadgeBtn");
const sampleCardBtn = document.getElementById("sampleCardBtn");

const modeSideBtn = document.getElementById("modeSideBtn");
const modeSliderBtn = document.getElementById("modeSliderBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const zoomReadout = document.getElementById("zoomReadout");
const cropToggleBtn = document.getElementById("cropToggleBtn");
const cropApplyBtn = document.getElementById("cropApplyBtn");
const cropCancelBtn = document.getElementById("cropCancelBtn");
const cropOverlay = document.getElementById("cropOverlay");
const cropBox = document.getElementById("cropBox");
const glowToggleBtn = document.getElementById("glowToggleBtn");
const customColorInput = document.getElementById("customColorInput");
const swatchButtons = document.querySelectorAll(".swatch-btn");

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "image/png,image/jpeg,image/jpg,image/webp";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

let removeBackground = null;
let loadingPromise = null;
let currentOriginalUrl = null;
let currentResultUrl = null;
let currentResultBlob = null;
let currentDownloadName = "background-removed.png";

let zoomLevel = 1;
let glowOn = false;
let isCropping = false;
let dragStart = null;
let cropRect = { left: 0.15, top: 0.15, width: 0.7, height: 0.7 };

function showNotice(message) {
  if (!noticeBanner) return;
  noticeBanner.textContent = message;
  noticeBanner.classList.add("show");
}

function clearNotice() {
  if (!noticeBanner) return;
  noticeBanner.textContent = "";
  noticeBanner.classList.remove("show");
}

function formatKb(bytes) {
  if (!bytes || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`;
}

function cleanupUrls() {
  if (currentOriginalUrl) {
    URL.revokeObjectURL(currentOriginalUrl);
    currentOriginalUrl = null;
  }
  if (currentResultUrl) {
    URL.revokeObjectURL(currentResultUrl);
    currentResultUrl = null;
  }
  currentResultBlob = null;
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = src;
  });
}

function applyZoom() {
  const pct = Math.round(zoomLevel * 100);
  if (zoomReadout) zoomReadout.textContent = `${pct}%`;
  const transform = `scale(${zoomLevel})`;
  if (originalImage) originalImage.style.transform = transform;
  if (resultImage) resultImage.style.transform = transform;
  if (sliderBeforeImage) sliderBeforeImage.style.transform = transform;
  if (sliderAfterImage) sliderAfterImage.style.transform = transform;
}

function updateSlider(val) {
  const pct = Math.max(0, Math.min(100, Number(val) || 50));
  if (sliderBeforeClip) sliderBeforeClip.style.width = `${pct}%`;
  if (sliderDivider) sliderDivider.style.left = `${pct}%`;
  if (compareRange) compareRange.value = String(pct);
}

function syncSliderWidth() {
  if (!sliderStage || !sliderBeforeImage) return;
  sliderBeforeImage.style.width = `${sliderStage.clientWidth}px`;
}

function renderCropBox() {
  if (!cropBox) return;
  cropBox.style.left = `${cropRect.left * 100}%`;
  cropBox.style.top = `${cropRect.top * 100}%`;
  cropBox.style.width = `${cropRect.width * 100}%`;
  cropBox.style.height = `${cropRect.height * 100}%`;
}

function setCropMode(active) {
  isCropping = active;
  if (active) {
    // Switch to side-by-side so cropping on resultStage is clear
    modeSideBtn?.click();
    cropRect = { left: 0.15, top: 0.15, width: 0.7, height: 0.7 };
    renderCropBox();
    cropOverlay?.classList.add("active");
    if (cropApplyBtn) cropApplyBtn.style.display = "inline-block";
    if (cropCancelBtn) cropCancelBtn.style.display = "inline-block";
    if (cropToggleBtn) cropToggleBtn.classList.add("active");
  } else {
    cropOverlay?.classList.remove("active");
    if (cropApplyBtn) cropApplyBtn.style.display = "none";
    if (cropCancelBtn) cropCancelBtn.style.display = "none";
    if (cropToggleBtn) cropToggleBtn.classList.remove("active");
  }
}

async function applyCroppedResult() {
  if (!currentResultBlob) return;
  const tempUrl = URL.createObjectURL(currentResultBlob);
  try {
    const img = await loadImageElement(tempUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const sx = Math.max(0, Math.floor(cropRect.left * w));
    const sy = Math.max(0, Math.floor(cropRect.top * h));
    const sw = Math.max(1, Math.min(w - sx, Math.floor(cropRect.width * w)));
    const sh = Math.max(1, Math.min(h - sy, Math.floor(cropRect.height * h)));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const croppedBlob = await new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob || currentResultBlob), "image/png")
    );

    if (currentResultUrl) URL.revokeObjectURL(currentResultUrl);
    currentResultBlob = croppedBlob;
    currentResultUrl = URL.createObjectURL(croppedBlob);
    resultImage.src = currentResultUrl;
    sliderAfterImage.src = currentResultUrl;

    if (resultMeta) {
      resultMeta.textContent = `Cropped ${sw}×${sh} px • ${formatKb(croppedBlob.size)}`;
    }
    setCropMode(false);
  } finally {
    URL.revokeObjectURL(tempUrl);
  }
}

async function createSampleFile(variant) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");

  const bgGrad = ctx.createLinearGradient(0, 0, 800, 800);
  if (variant === "card") {
    bgGrad.addColorStop(0, "#1d0c3b");
    bgGrad.addColorStop(1, "#0b1936");
  } else {
    bgGrad.addColorStop(0, "#0b2247");
    bgGrad.addColorStop(1, "#123b6e");
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 800);

  ctx.save();
  ctx.translate(400, 400);
  ctx.fillStyle = variant === "card" ? "#ff9900" : "#00d4ff";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = Math.cos(angle) * 230;
    const y = Math.sin(angle) * 230;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#060c1f";
  ctx.beginPath();
  ctx.arc(0, 0, 145, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 54px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(variant === "card" ? "PRO" : "AI BG", 0, 0);
  ctx.restore();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new File([blob], variant === "card" ? "gaming-emblem.png" : "neon-badge.png", {
    type: "image/png"
  });
}

async function createFastInput(file, originalImg) {
  const origWidth = originalImg.naturalWidth || originalImg.width;
  const origHeight = originalImg.naturalHeight || originalImg.height;
  const longestSide = Math.max(origWidth, origHeight);

  if (!longestSide || longestSide <= MAX_AI_DIMENSION) {
    return { aiInput: file, origWidth, origHeight, wasResized: false };
  }

  const scale = MAX_AI_DIMENSION / longestSide;
  const targetWidth = Math.max(1, Math.round(origWidth * scale));
  const targetHeight = Math.max(1, Math.round(origHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(originalImg, 0, 0, targetWidth, targetHeight);

  const resizedBlob = await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.92);
  });

  return {
    aiInput: resizedBlob,
    origWidth,
    origHeight,
    wasResized: resizedBlob !== file
  };
}

async function restoreOriginalDimensions(resultBlob, origWidth, origHeight, wasResized) {
  if (!wasResized || !origWidth || !origHeight) {
    return resultBlob;
  }

  const tempUrl = URL.createObjectURL(resultBlob);
  try {
    const cutoutImg = await loadImageElement(tempUrl);
    const canvas = document.createElement("canvas");
    canvas.width = origWidth;
    canvas.height = origHeight;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, origWidth, origHeight);
    ctx.drawImage(cutoutImg, 0, 0, origWidth, origHeight);

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob || resultBlob), "image/png");
    });
  } finally {
    URL.revokeObjectURL(tempUrl);
  }
}

async function loadAI() {
  if (removeBackground) return removeBackground;
  if (!loadingPromise) {
    loadingPromise = import(PACKAGE_URL).then((module) => {
      const candidate = module.default || module.removeBackground || module;
      if (typeof candidate === "function") return candidate;
      if (typeof module.removeBackground === "function") return module.removeBackground;
      throw new Error("Could not initialize background removal library.");
    });
  }
  removeBackground = await loadingPromise;
  return removeBackground;
}

function openPicker(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  clearNotice();
  fileInput.value = "";
  fileInput.click();
}

function resetToUpload() {
  setCropMode(false);
  zoomLevel = 1;
  applyZoom();
  cleanupUrls();
  if (originalImage) originalImage.removeAttribute("src");
  if (resultImage) resultImage.removeAttribute("src");
  if (sliderBeforeImage) sliderBeforeImage.removeAttribute("src");
  if (sliderAfterImage) sliderAfterImage.removeAttribute("src");
  if (originalMeta) originalMeta.textContent = "—";
  if (resultMeta) resultMeta.textContent = "—";
  if (resultSection) resultSection.classList.remove("show");
  if (processing) processing.classList.remove("show");
  if (uploadBox) uploadBox.style.display = "";
  if (statusText) statusText.textContent = "AI ENGINE ONLINE";
  if (statusDot) statusDot.style.background = "#00ff88";
}

// View Mode Buttons
modeSideBtn?.addEventListener("click", () => {
  modeSideBtn.classList.add("active");
  modeSliderBtn?.classList.remove("active");
  if (sideBySideView) sideBySideView.style.display = "grid";
  sliderView?.classList.remove("show");
});

modeSliderBtn?.addEventListener("click", () => {
  setCropMode(false);
  modeSliderBtn.classList.add("active");
  modeSideBtn?.classList.remove("active");
  if (sideBySideView) sideBySideView.style.display = "none";
  sliderView?.classList.add("show");
  syncSliderWidth();
  updateSlider(compareRange?.value || 50);
});

compareRange?.addEventListener("input", (e) => updateSlider(e.target.value));
window.addEventListener("resize", syncSliderWidth);

// Zoom Controls
zoomInBtn?.addEventListener("click", () => {
  zoomLevel = Math.min(3, Number((zoomLevel + 0.25).toFixed(2)));
  applyZoom();
});

zoomOutBtn?.addEventListener("click", () => {
  zoomLevel = Math.max(0.5, Number((zoomLevel - 0.25).toFixed(2)));
  applyZoom();
});

zoomResetBtn?.addEventListener("click", () => {
  zoomLevel = 1;
  applyZoom();
});

// Crop Controls
cropToggleBtn?.addEventListener("click", () => setCropMode(!isCropping));
cropCancelBtn?.addEventListener("click", () => setCropMode(false));
cropApplyBtn?.addEventListener("click", applyCroppedResult);

cropOverlay?.addEventListener("pointerdown", (e) => {
  if (!isCropping) return;
  const rect = cropOverlay.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  dragStart = { x, y };
  cropRect = { left: x, top: y, width: 0.02, height: 0.02 };
  renderCropBox();
});

cropOverlay?.addEventListener("pointermove", (e) => {
  if (!isCropping || !dragStart) return;
  const rect = cropOverlay.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  cropRect = {
    left: Math.min(dragStart.x, x),
    top: Math.min(dragStart.y, y),
    width: Math.max(0.05, Math.abs(x - dragStart.x)),
    height: Math.max(0.05, Math.abs(y - dragStart.y))
  };
  renderCropBox();
});

window.addEventListener("pointerup", () => {
  dragStart = null;
});

// Glow Toggle
glowToggleBtn?.addEventListener("click", () => {
  glowOn = !glowOn;
  resultSection?.classList.toggle("glow-enabled", glowOn);
  glowToggleBtn.classList.toggle("active", glowOn);
  glowToggleBtn.textContent = glowOn ? "Edge Glow: On" : "Edge Glow: Off";
});

// Backdrop Presets & Custom Color
function applyPresetClass(mode) {
  const stages = [resultStage, sliderStage];
  stages.forEach((stage) => {
    if (!stage) return;
    stage.style.background = "";
    stage.style.backgroundColor = "";
    stage.style.backgroundImage = "";
    stage.classList.remove("bg-dark", "bg-light", "bg-neon", "bg-sunset", "bg-green");
    if (mode && mode !== "checker") {
      stage.classList.add(`bg-${mode}`);
    }
  });
}

swatchButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    swatchButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyPresetClass(btn.dataset.bg || "checker");
  });
});

customColorInput?.addEventListener("input", (e) => {
  swatchButtons.forEach((b) => b.classList.remove("active"));
  const color = e.target.value;
  [resultStage, sliderStage].forEach((stage) => {
    if (!stage) return;
    stage.classList.remove("bg-dark", "bg-light", "bg-neon", "bg-sunset", "bg-green");
    stage.style.backgroundImage = "none";
    stage.style.backgroundColor = color;
  });
});

// Upload & Samples
uploadBtn.addEventListener("click", openPicker);
uploadBox.addEventListener("click", (event) => {
  if (event.target !== uploadBtn && !event.target.closest(".sample-row")) {
    openPicker(event);
  }
});

sampleBadgeBtn?.addEventListener("click", async (event) => {
  event.stopPropagation();
  processFile(await createSampleFile("badge"));
});

sampleCardBtn?.addEventListener("click", async (event) => {
  event.stopPropagation();
  processFile(await createSampleFile("card"));
});

["dragenter", "dragover"].forEach((type) =>
  uploadBox.addEventListener(type, (event) => {
    event.preventDefault();
    event.stopPropagation();
    uploadBox.classList.add("drag-over");
  })
);

["dragleave", "drop"].forEach((type) =>
  uploadBox.addEventListener(type, (event) => {
    event.preventDefault();
    event.stopPropagation();
    uploadBox.classList.remove("drag-over");
  })
);

uploadBox.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files?.[0];
  if (file) processFile(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) processFile(file);
});

newBtn?.addEventListener("click", resetToUpload);

downloadBtn?.addEventListener("click", () => {
  if (!currentResultUrl) return;
  const link = document.createElement("a");
  link.href = currentResultUrl;
  link.download = currentDownloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

async function processFile(file) {
  clearNotice();

  if (!file.type.startsWith("image/")) {
    showNotice("Please select a valid image file (PNG, JPG, JPEG, or WEBP).");
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    showNotice("Maximum file size is 10MB. Please choose a smaller image.");
    return;
  }

  setCropMode(false);
  zoomLevel = 1;
  applyZoom();
  cleanupUrls();

  const baseName = (file.name || "image").replace(/\.[^.]+$/, "");
  currentDownloadName = `${baseName}-no-bg.png`;

  currentOriginalUrl = URL.createObjectURL(file);
  originalImage.src = currentOriginalUrl;
  if (sliderBeforeImage) sliderBeforeImage.src = currentOriginalUrl;

  uploadBox.style.display = "none";
  resultSection.classList.remove("show");
  processing.classList.add("show");
  statusText.textContent = "AI PROCESSING...";
  statusDot.style.background = "#00b7ff";
  processingText.textContent = "PROCESSING IMAGE...";
  processingSub.textContent = "Removing background locally in your browser...";

  try {
    const [originalImg, remove] = await Promise.all([
      loadImageElement(currentOriginalUrl),
      loadAI()
    ]);

    const { aiInput, origWidth, origHeight, wasResized } = await createFastInput(
      file,
      originalImg
    );

    if (originalMeta) {
      originalMeta.textContent = `${origWidth}×${origHeight} px • ${formatKb(file.size)}`;
    }

    const rawResultBlob = await remove(aiInput, {
      model: "isnet_quint8",
      publicPath: MODEL_DATA_URL,
      output: { format: "image/png", type: "foreground" }
    });

    const finalPngBlob = await restoreOriginalDimensions(
      rawResultBlob,
      origWidth,
      origHeight,
      wasResized
    );

    currentResultBlob = finalPngBlob;
    currentResultUrl = URL.createObjectURL(finalPngBlob);
    resultImage.src = currentResultUrl;
    if (sliderAfterImage) sliderAfterImage.src = currentResultUrl;

    if (resultMeta) {
      resultMeta.textContent = `${origWidth}×${origHeight} px • ${formatKb(finalPngBlob.size)}`;
    }

    processing.classList.remove("show");
    resultSection.classList.add("show");
    syncSliderWidth();
    updateSlider(50);
    statusText.textContent = "AI ENGINE ONLINE";
    statusDot.style.background = "#00ff88";
  } catch (error) {
    console.error("Background removal error:", error);
    showNotice("Could not remove background: " + (error?.message || "Please try another image."));
    resetToUpload();
  }
}
