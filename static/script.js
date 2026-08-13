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
fileInput.accept = "image/png,image/jpeg,image/jpg";
fileInput.style.display = "none";

document.body.appendChild(fileInput);


// OPEN FILE SELECTOR
uploadBtn.addEventListener("click", () => {
    fileInput.click();
});


// IMAGE SELECTED
fileInput.addEventListener("change", async () => {

    const file = fileInput.files[0];

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

    let progress = 0;

    progressBar.style.width = "0%";
    percentage.textContent = "0%";


    const timer = setInterval(() => {

        if (progress < 85) {
            progress += 2;
        }

        progressBar.style.width = progress + "%";
        percentage.textContent = progress + "%";


        if (progress < 35) {

            processingText.textContent = "ANALYZING IMAGE...";
            processingSub.textContent =
                "AI is detecting the subject";

        } else if (progress < 70) {

            processingText.textContent =
                "DETECTING SUBJECT...";

            processingSub.textContent =
                "Creating precise subject mask";

        } else {

            processingText.textContent =
                "REMOVING BACKGROUND...";

            processingSub.textContent =
                "AI is processing your image";
        }

    }, 60);


    try {

        const formData = new FormData();

        formData.append("image", file);


        const response = await fetch(
            "/remove-background",
            {
                method: "POST",
                body: formData
            }
        );


        if (!response.ok) {
            throw new Error("Background removal failed.");
        }


        const blob = await response.blob();

        const resultURL = URL.createObjectURL(blob);


        clearInterval(timer);

        progressBar.style.width = "100%";
        percentage.textContent = "100%";


        finishProcessing(resultURL);


    } catch (error) {

        clearInterval(timer);

        console.error(error);

        processing.classList.remove("show");

        uploadBox.style.display = "block";

        statusText.textContent = "AI ENGINE ERROR";

        statusDot.style.background = "#ff3333";

        alert(
            "Something went wrong while removing the background."
        );
    }

});


// FINISH PROCESSING
function finishProcessing(resultURL) {

    processingText.textContent =
        "BACKGROUND REMOVED ✓";

    processingSub.textContent =
        "AI processing complete";

    statusText.textContent =
        "AI ENGINE READY";

    statusDot.style.background =
        "#00ff88";

    resultImage.src = resultURL;


    setTimeout(() => {

        processing.classList.remove("show");

        resultSection.classList.add("show");

        resultSection.scrollIntoView({
            behavior: "smooth"
        });

    }, 700);
}


// DOWNLOAD RESULT
downloadBtn.addEventListener("click", () => {

    if (!resultImage.src) return;

    const link = document.createElement("a");

    link.href = resultImage.src;

    link.download =
        "AI-Background-Removed.png";

    document.body.appendChild(link);

    link.click();

    link.remove();
});


// NEW IMAGE
newBtn.addEventListener("click", () => {

    resultSection.classList.remove("show");

    uploadBox.style.display = "block";

    processing.classList.remove("show");

    progressBar.style.width = "0%";

    percentage.textContent = "0%";

    processingText.textContent =
        "ANALYZING IMAGE...";

    processingSub.textContent =
        "AI is detecting the subject";

    statusText.textContent =
        "AI ENGINE ONLINE";

    statusDot.style.background =
        "#00ff88";

    originalImage.src = "";
    resultImage.src = "";

    fileInput.value = "";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});