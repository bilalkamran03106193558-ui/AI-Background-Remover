import imglyRemoveBackground from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";

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

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Please select an image.");
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert("Maximum file size is 10MB.");
        return;
    }

    const imageURL = URL.createObjectURL(file);
    originalImage.src = imageURL;
    uploadBox.style.display = "none";
    resultSection.classList.remove("show");
    processing.classList.add("show");
    statusText.textContent = "AI PROCESSING...";
    statusDot.style.background = "#00b7ff";
    progressBar.style.width = "0%";
    percentage.textContent = "0%";
    processingText.textContent = "LOADING AI MODEL...";
    processingSub.textContent = "The first run may take a little longer.";

    try {
        const resultBlob = await imglyRemoveBackground(file, {
            model: "isnet_fp16",
            output: { format: "image/png", type: "foreground" },
            progress: (key, current, total) => {
                if (total > 0) {
                    const percent = Math.max(1, Math.min(99, Math.round((current / total) * 100)));
                    progressBar.style.width = `${percent}%`;
                    percentage.textContent = `${percent}%`;
                }
                processingText.textContent = "REMOVING BACKGROUND...";
                processingSub.textContent = "AI is processing your image in this browser";
            }
        });

        const resultURL = URL.createObjectURL(resultBlob);
        progressBar.style.width = "100%";
        percentage.textContent = "100%";
        finishProcessing(resultURL);
    } catch (error) {
        console.error("Background removal error:", error);
        processing.classList.remove("show");
        uploadBox.style.display = "block";
        statusText.textContent = "AI ENGINE ERROR";
        statusDot.style.background = "#ff3333";
        alert("Background removal failed. Please try again or use a smaller image.");
    }
});

function finishProcessing(resultURL) {
    processingText.textContent = "BACKGROUND REMOVED ✓";
    processingSub.textContent = "AI processing complete";
    statusText.textContent = "AI ENGINE READY";
    statusDot.style.background = "#00ff88";
    resultImage.src = resultURL;

    setTimeout(() => {
        processing.classList.remove("show");
        resultSection.classList.add("show");
        resultSection.scrollIntoView({ behavior: "smooth" });
    }, 500);
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
    uploadBox.style.display = "block";
    processing.classList.remove("show");
    progressBar.style.width = "0%";
    percentage.textContent = "0%";
    processingText.textContent = "LOADING AI MODEL...";
    processingSub.textContent = "The first run may take a little longer.";
    statusText.textContent = "AI ENGINE ONLINE";
    statusDot.style.background = "#00ff88";
    originalImage.src = "";
    resultImage.src = "";
    fileInput.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
});
