const PACKAGE_URL = "[https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm](https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm)";
const MODEL_DATA_URL = "[https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/](https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/)";
const MAX_IMAGE_DIMENSION = 1280;

const uploadBtn = document.getElementById("uploadBtn");
const uploadBox = document.getElementById("uploadBox");
const processing = document.getElementById("processing");
const resultSection = document.getElementById("resultSection");
const originalImage = document.getElementById("originalImage");
const resultImage = document.getElementById("resultImage");
const progressBar = document.getElementById("progressBar");
const percentage = document.getElementById("percentage");
const processingText = document.getElementById("processingText");
const processingSub = document.getElementById("processingSub");
const statusText = document.getElementById("statusText");
const statusDot = document.querySelector(".status-dot");
const downloadBtn = document.getElementById("downloadBtn");
const newBtn = document.getElementById("newBtn");

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "image/png,image/jpeg,image/jpg,image/webp";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

let removeBackground = null;
let loadingPromise = null;
let currentOriginalUrl = null;
let currentResultUrl = null;
let currentDownloadName = "background-removed.png";

function cleanupUrls() {
  if (currentOriginalUrl) {
    URL.revokeObjectURL(currentOriginalUrl);
    currentOriginalUrl = null;
  }
  if (currentResultUrl) {
    URL.revokeObjectURL(currentResultUrl);
    currentResultUrl = null;
  }
}

function setProgress(value) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  if (progressBar) progressBar.style.width = `${clamped}%`;
  if (percentage) percentage.textContent = `${clamped}%`;
}

async function prepareImageForAI(file) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const longestSide = Math.max(width, height);

  if (longestSide <= MAX_IMAGE_DIMENSION) {
    bitmap.close();
    return file;
  }

  const scale = MAX_IMAGE_DIMENSION / longestSide;
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not resize image."));
      },
      "image/jpeg",
      0.9
    );
  });
}

async function loadAI() {
  if (removeBackground) return removeBackground;
  if (!loadingPromise) {
    loadingPromise = import(PACKAGE_URL).then((module) => {
      const candidate = module.default || module.removeBackground || module;
      if (typeof candidate === "function") return candidate;
      if (typeof module.removeBackground === "function") return module.removeBackground;
      throw new Error("AI library loaded, but removeBackground was not found.");
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
  fileInput.value = "";
  fileInput.click();
}

function resetToUpload() {
  cleanupUrls();
  if (originalImage) originalImage.removeAttribute("src");
  if (resultImage) resultImage.removeAttribute("src");
  if (resultSection) resultSection.classList.remove("show");
  if (processing) processing.classList.remove("show");
  if (uploadBox) uploadBox.style.display = "";
  if (statusText) statusText.textContent = "AI ENGINE ONLINE";
  if (statusDot) statusDot.style.background = "#00ff88";
  setProgress(0);
}

uploadBtn.addEventListener("click", openPicker);
uploadBox.addEventListener("click", (event) => {
  if (event.target !== uploadBtn) openPicker(event);
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

if (newBtn) {
  newBtn.addEventListener("click", resetToUpload);
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    if (!currentResultUrl) return;
    const link = document.createElement("a");
    link.href = currentResultUrl;
    link.download = currentDownloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

async function processFile(file) {
  if (!file.type.startsWith("image/")) {
    alert("Please select an image file.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert("Maximum file size is 10MB.");
    return;
  }

  cleanupUrls();
  const baseName = (file.name || "image").replace(/\.[^.]+$/, "");
  currentDownloadName = `${baseName}-no-bg.png`;

  currentOriginalUrl = URL.createObjectURL(file);
  originalImage.src = currentOriginalUrl;

  uploadBox.style.display = "none";
  resultSection.classList.remove("show");
  processing.classList.add("show");
  statusText.textContent = "AI PROCESSING...";
  statusDot.style.background = "#00b7ff";
  setProgress(2);
  processingText.textContent = "PREPARING IMAGE...";
  processingSub.textContent = "Optimizing image size for fast browser processing...";

  try {
    const inputForAI = await prepareImageForAI(file);
    setProgress(5);
    processingText.textContent = "LOADING AI MODEL...";
    processingSub.textContent = "First use may take longer while the AI model downloads.";

    const remove = await loadAI();
    processingText.textContent = "REMOVING BACKGROUND...";
    processingSub.textContent = "AI is running locally in your browser. Please wait...";

    let lastShown = 5;
    const resultBlob = await remove(inputForAI, {
      model: "isnet_quint8",
      publicPath: MODEL_DATA_URL,
      output: { format: "image/png", type: "foreground" },
      progress: (key, current, total) => {
        if (!total || total <= 0) return;
        const stage = String(key || "").toLowerCase();
        let start = 5;
        let end = 95;
        if (stage.includes("fetch")) {
          start = 5;
          end = 55;
        } else if (stage.includes("decode")) {
          start = 55;
          end = 65;
        } else if (stage.includes("inference") || stage.includes("compute")) {
          start = 65;
          end = 88;
        } else {
          start = 88;
          end = 96;
        }

        const ratio = Math.max(0, Math.min(1, current / total));
        const mapped = start + ratio * (end - start);
        if (mapped > lastShown) {
          lastShown = mapped;
          setProgress(mapped);
        }
      }
    });

    currentResultUrl = URL.createObjectURL(resultBlob);
    resultImage.src = currentResultUrl;

    setProgress(100);
    processing.classList.remove("show");
    resultSection.classList.add("show");
    statusText.textContent = "AI ENGINE ONLINE";
    statusDot.style.background = "#00ff88";
  } catch (error) {
    console.error("Background removal error:", error);
    alert("Could not remove background. Please try another image or refresh the page.");
    resetToUpload();
  }
}
