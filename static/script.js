const PACKAGE_URL = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";
const MODEL_DATA_URL = "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/";

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

async function loadAI() {
    if (removeBackground) return removeBackground;
    if (!loadingPromise) {
        loadingPromise = import(PACKAGE_URL).then(module => {
            // IMG.LY's ESM build can expose the function in different module shapes.
            const candidate = module.default || module.removeBackground || module;
            if (typeof candidate === "function") return candidate;
            if (typeof module.removeBackground === "function") return module.removeBackground;
            throw new Error("AI library loaded, but its removeBackground function was not found.");
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
    fileInput.click();
}

uploadBtn.addEventListener("click", openPicker);
uploadBox.addEventListener("click", event => {
    if (event.target !== uploadBtn) openPicker(event);
});

["dragenter", "dragover"].forEach(type => {
    uploadBox.addEventListener(type, event => {
        event.preventDefault();
        event.stopPropagation();
        uploadBox.classList.add("drag-over");
    });
});

["dragleave", "drop"].forEach(type => {
    uploadBox.addEventListener(type, event => {
        event.preventDefault();
        event.stopPropagation();
        uploadBox.classList.remove("drag-over");
    });
});

uploadBox.addEventListener("drop", event => {
    const file = event.dataTransfer.files?.[0];
    if (file) processFile(file);
});

fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) processFile(file);
});

async function processFile(file) {
    if (!file.type.startsWith("image/")) {
        alert("Please select an image file.");
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        alert("Maximum file size is 10MB.");
        return;
    }

    originalImage.src = URL.createObjectURL(file);
    uploadBox.style.display = "none";
    resultSection.classList.remove("show");
    processing.classList.add("show");
    statusText.textContent = "AI PROCESSING...";
    statusDot.style.background = "#00b7ff";
    progressBar.style.width = "1%";
    percentage.textContent = "1%";
    processingText.textContent = "LOADING AI MODEL...";
    processingSub.textContent = "First use may take a little longer while the model downloads.";

    try {
        const remove = await loadAI();
        processingText.textContent = "REMOVING BACKGROUND...";

        const resultBlob = await remove(file, {
            model: "isnet_fp16",
            publicPath: MODEL_DATA_URL,
            output: { format: "image/png", type: "foreground" },
            progress: (key, current, total) => {
                if (total > 0) {
                    const percent = Math.max(2, Math.min(99, Math.round(current / total * 100)));
                    progressBar.style.width = `${percent}%`;
                    percentage.textContent = `${percent}%`;
                }
                processingSub.textContent = "AI is processing your image in this browser.";
            }
        });

        const resultURL = URL.createObjectURL(resultBlob);
        resultImage.src = resultURL;
        progressBar.style.width = "100%";
        percentage.textContent = "100%";
        statusText.textContent = "AI ENGINE READY";
        statusDot.style.background = "#00ff88";
        processingText.textContent = "BACKGROUND REMOVED ✓";
        processingSub.textContent = "AI processing complete.";

        setTimeout(() => {
            processing.classList.remove("show");
            resultSection.classList.add("show");
            resultSection.scrollIntoView({ behavior: "smooth" });
        }, 500);
    } catch (error) {
        console.error("Background removal error:", error);
        processing.classList.remove("show");
        uploadBox.style.display = "block";
        statusText.textContent = "AI ENGINE ERROR";
        statusDot.style.background = "#ff3333";
        alert(`Background removal failed.\n\nError: ${error?.message || error}`);
    }
}

downloadBtn.addEventListener("click", () => {
    if (!resultImage.src) return;
    const link = document.createElement("a");
    link.href = resultImage.src;
    link.download = "AI-Background-Removed.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
});

newBtn.addEventListener("click", () => {
    resultSection.classList.remove("show");
    processing.classList.remove("show");
    uploadBox.style.display = "block";
    progressBar.style.width = "0%";
    percentage.textContent = "0%";
    statusText.textContent = "AI ENGINE ONLINE";
    statusDot.style.background = "#00ff88";
    originalImage.src = "";
    resultImage.src = "";
    fileInput.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
});
