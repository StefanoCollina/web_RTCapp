// lavagna.js
let eraserActive = false;
let boardChannel;
let currentColor = "#000000"; // colore di default
let drawing = false;
let lastPos = null;
let immagini = []; // array immagini con Image già caricate
let linee = []; // linee locali + remote
let bufferInvio = []; // buffer per messaggi inviati prima che il canale sia aperto
const immaginiInDownload = {}; // buffer per ricezione immagini in chunk

// --- Variabili per ridimensionamento immagini ---
let selectedImage = null;
let resizeStart = null;
let resizing = false;
const HANDLE_SIZE = 10; // dimensione dei maniglioni agli angoli

// --- Setup DataChannel ---
export function setupBoardChannel(channel) {
    boardChannel = channel;
    console.log("📡 Setup boardChannel, stato iniziale:", boardChannel.readyState);

    boardChannel.onopen = () => {
        console.log("✅ Lavagna pronta, stato:", boardChannel.readyState);

        while (bufferInvio.length) {
            const msg = bufferInvio.shift();
            boardChannel.send(JSON.stringify(msg));
        }
    };

    boardChannel.onmessage = (event) => {
        riceviUpdateLavagna(event.data);
    };
}

// --- Invio aggiornamento ---
function inviaUpdateLavagna(dati) {
    if (boardChannel?.readyState === "open") {
        boardChannel.send(JSON.stringify(dati));
    } else {
        bufferInvio.push(dati);
    }
}

// --- Canvas setup ---
const canvas = document.getElementById("whiteboard-canvas");
const ctx = canvas.getContext("2d");
ctx.lineWidth = 2;
ctx.strokeStyle = currentColor;

// --- Mouse events ---
function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (evt.clientX - rect.left) * (canvas.width / rect.width),
        y: (evt.clientY - rect.top) * (canvas.height / rect.height),
    };
}

canvas.addEventListener("mousedown", (e) => {
    const pos = getMousePos(e);

    // controlla se clicco su un maniglione per ridimensionare
    for (let i = immagini.length - 1; i >= 0; i--) {
        const img = immagini[i];
        const handle = { x: img.x + img.width, y: img.y + img.height }; // angolo in basso a destra
        if (
            pos.x >= handle.x - HANDLE_SIZE && pos.x <= handle.x + HANDLE_SIZE &&
            pos.y >= handle.y - HANDLE_SIZE && pos.y <= handle.y + HANDLE_SIZE
        ) {
            selectedImage = img;
            resizing = true;
            resizeStart = pos;
            return;
        }
    }

    // se non sto ridimensionando, controllo per selezione immagine (spostamento)
    for (let i = immagini.length - 1; i >= 0; i--) {
        const img = immagini[i];
        if (
            pos.x >= img.x && pos.x <= img.x + img.width &&
            pos.y >= img.y && pos.y <= img.y + img.height
        ) {
            selectedImage = img;
            resizing = false; // spostamento normale
            resizeStart = pos;
            return;
        }
    }

    // se non clicco nessuna immagine, disegno normale
    drawing = true;
    lastPos = pos;
});

canvas.addEventListener("mousemove", (e) => {
    const pos = getMousePos(e);

    if (selectedImage && resizeStart) {
        if (resizing) {
            // ridimensionamento proporzionale
            const dx = pos.x - resizeStart.x;
            const dy = pos.y - resizeStart.y;

            const scale = Math.min(
                (selectedImage.width + dx) / selectedImage.width,
                (selectedImage.height + dy) / selectedImage.height
            );

            selectedImage.width *= scale;
            selectedImage.height *= scale;
            resizeStart = pos;
            drawBoard();
        } else {
            // spostamento immagine
            const dx = pos.x - resizeStart.x;
            const dy = pos.y - resizeStart.y;
            selectedImage.x += dx;
            selectedImage.y += dy;
            resizeStart = pos;
            drawBoard();
        }
        return;
    }

    // disegno linee
    if (!drawing) return;

    const segmento = {
        type: "line",
        from: lastPos,
        to: pos,
        color: eraserActive ? "#FFFFFF" : currentColor,
        width: ctx.lineWidth,
    };

    ctx.save();
    if (eraserActive) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = segmento.color;
    }
    ctx.lineWidth = segmento.width;
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.restore();

    linee.push(segmento);
    inviaUpdateLavagna(segmento);
    lastPos = pos;
});

canvas.addEventListener("mouseup", () => {
    if (selectedImage) {
        inviaUpdateLavagna({
            type: "updateImage",
            id: selectedImage.id,
            x: selectedImage.x,
            y: selectedImage.y,
            width: selectedImage.width,
            height: selectedImage.height
        });
    }
    drawing = false;
    lastPos = null;
    selectedImage = null;
    resizeStart = null;
    resizing = false;
});

canvas.addEventListener("mouseout", () => {
    drawing = false;
    lastPos = null;
    selectedImage = null;
    resizeStart = null;
    resizing = false;
});

// --- Ricezione ---
export function riceviUpdateLavagna(dati) {
    let obj;
    try {
        obj = typeof dati === "string" ? JSON.parse(dati) : dati;
    } catch (err) {
        console.error("Errore parsing lavagna:", err, dati);
        return;
    }

    if (obj.type === "line") {
        linee.push(obj);
        drawBoard();
    } else if (obj.type === "clear") {
        linee = [];
        immagini = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } 
    // --- Ricezione immagini chunk ---
    else if (obj.type === "imgChunk") {
        if (!immaginiInDownload[obj.id]) immaginiInDownload[obj.id] = { chunks: [] };
        immaginiInDownload[obj.id].chunks.push(obj.data);
    } 
    else if (obj.type === "imgEnd") {
        const joined = immaginiInDownload[obj.id].chunks.join("");
        delete immaginiInDownload[obj.id];

        const image = new Image();
        image.onload = () => {
            immagini.push({
                id: obj.id,
                image: image,
                x: obj.x,
                y: obj.y,
                width: obj.width,
                height: obj.height,
            });
            drawBoard();
        };
        image.src = joined;
    }
    // --- Aggiornamento immagine ridimensionata/spostata ---
    else if (obj.type === "updateImage") {
        const img = immagini.find(i => i.id === obj.id);
        if (img) {
            img.x = obj.x;
            img.y = obj.y;
            img.width = obj.width;
            img.height = obj.height;
            drawBoard();
        }
    }
}

// --- Pulsanti colore e clear ---
export function setupColorButtons() {
    document.querySelectorAll(".color-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            currentColor = btn.dataset.color;
        });
    });

    const clearBtn = document.getElementById("clear-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            linee = [];
            immagini = [];
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            inviaUpdateLavagna({ type: "clear" });
        });
    }
}

// --- Upload immagini ---
export function setupImageUpload() {
    const input = document.getElementById("image-upload");
    if (!input) return;

    input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            const MAX_WIDTH = canvas.width - 20 ;   
            const MAX_HEIGHT = canvas.height - 20;

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // scala proporzionalmente senza ingrandire immagini piccole
                const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
                width = width * scale;
                height = height * scale;

                const imgObj = {
                    id: crypto.randomUUID(),
                    image: img,
                    x: 10,
                    y: 10,
                    width: width,
                    height: height,
                    src: reader.result,
                };

                immagini.push(imgObj);
                drawBoard();
                inviaImmagineInChunk(imgObj);
            };

            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// --- Invio immagine in chunk ---
function inviaImmagineInChunk(imgObj) {
    const chunkSize = 16000;
    const src = imgObj.src;
    for (let i = 0; i < src.length; i += chunkSize) {
        const chunk = src.slice(i, i + chunkSize);
        inviaUpdateLavagna({ type: "imgChunk", id: imgObj.id, data: chunk });
    }
    inviaUpdateLavagna({
        type: "imgEnd",
        id: imgObj.id,
        x: imgObj.x,
        y: imgObj.y,
        width: imgObj.width,
        height: imgObj.height,
    });
}

// --- Ridisegna tutto ---
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1️⃣ immagini
    for (const img of immagini) {
        ctx.drawImage(img.image, img.x, img.y, img.width, img.height);

        // mostra maniglione se selezionata
        if (img === selectedImage) {
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(img.x + img.width - HANDLE_SIZE / 2, img.y + img.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        }
    }

    // 2️⃣ linee sopra immagini
    for (const seg of linee) {
        ctx.save();
        if (seg.color === "#FFFFFF") {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = seg.color;
        }
        ctx.lineWidth = seg.width;
        ctx.beginPath();
        ctx.moveTo(seg.from.x, seg.from.y);
        ctx.lineTo(seg.to.x, seg.to.y);
        ctx.stroke();
        ctx.restore();
    }
}

// --- Brush size ---
export function setupBrushSize() {
    const brushSizeInput = document.getElementById("brush-size");
    const brushSizeLabel = document.getElementById("brush-size-label");

    if (!brushSizeInput || !brushSizeLabel) return;

    brushSizeInput.addEventListener("input", () => {
        ctx.lineWidth = parseInt(brushSizeInput.value);
        brushSizeLabel.textContent = brushSizeInput.value;
    });
}

// --- Eraser buttons ---
export function setupEraserButtons() {
    const eraserBtn = document.getElementById("eraser-btn");
    const penBtn = document.getElementById("pen-btn");

    if (eraserBtn) {
        eraserBtn.addEventListener("click", () => {
            eraserActive = true;
        });
    }

    if (penBtn) {
        penBtn.addEventListener("click", () => {
            eraserActive = false;
        });
    }
}
