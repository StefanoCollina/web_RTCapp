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

// ridimensionamento
let selectedImage = null;
let resizeStart = null;
let resizing = false;
const HANDLE_SIZE = 10; // dimensione dei maniglioni agli angoli

// Setup DataChannel 
export function setupBoardChannel(channel) {
    boardChannel = channel;
    boardChannel.onopen = () => {

        while (bufferInvio.length) { // finchè non esiste almeno un elemento nel buffer (finchè la coda non è vuota)
            const msg = bufferInvio.shift(); // rimuove il primo elemento --> msg è quello da inviare
            boardChannel.send(JSON.stringify(msg));
        }
    };

    boardChannel.onmessage = (event) => {
        riceviUpdateLavagna(event.data);
    };
}

// Invio aggiornamento
function inviaUpdateLavagna(dati) { // se esiste ed è pronto il canale invii, sennò metti nel buffer
    
    if (boardChannel?.readyState === "open") {
        boardChannel.send(JSON.stringify(dati));
    } else {
        bufferInvio.push(dati);
    }
}

// Canvas setup
const canvas = document.getElementById("whiteboard-canvas");
const ctx = canvas.getContext("2d"); // oggetto con cui fare tutte le operazioni di disegno
ctx.lineWidth = 2;
ctx.strokeStyle = currentColor;

// Mouse events
function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect(); // ottiene posizione e dimensioni del canvas
    return {
        x: (evt.clientX - rect.left) * (canvas.width / rect.width), // distanza dal bordo sx * rapporto di scala
        y: (evt.clientY - rect.top) * (canvas.height / rect.height),
    };
}

canvas.addEventListener("mousedown", (e) => { // quando viene premuto tasto sx sul canvas
    const pos = getMousePos(e);

    // controlla se clicco su un maniglione per ridimensionare
    for (let i = immagini.length - 1; i >= 0; i--) { // scorre le immagini presenti sul canvas
        const img = immagini[i];
        const handle = { x: img.x + img.width, y: img.y + img.height }; // angolo in basso a destra
        if ( // controllo che il mouse si trovi nel quadrato per ridimensionare
            pos.x >= handle.x - HANDLE_SIZE && pos.x <= handle.x + HANDLE_SIZE &&
            pos.y >= handle.y - HANDLE_SIZE && pos.y <= handle.y + HANDLE_SIZE
        ) {
            selectedImage = img; // salvi immagine da ridimensionare
            resizing = true;
            resizeStart = pos;
            return;
        }
    }

    // se non sto ridimensionando, controllo per spostamento
    for (let i = immagini.length - 1; i >= 0; i--) {
        const img = immagini[i];
        if ( // controllo se clicco su immagine
            pos.x >= img.x && pos.x <= img.x + img.width &&
            pos.y >= img.y && pos.y <= img.y + img.height
        ) {
            selectedImage = img; // salvi immagine da spostare
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
            // calcolo di quanto si è spostato il mouse
            const dx = pos.x - resizeStart.x;
            const dy = pos.y - resizeStart.y;

            const scale = Math.min( // prende il minore per non modificare le proporzioni
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
        color: eraserActive ? "#FFFFFF" : currentColor, // se è attiva la gomma il colore è bianco, altrimenti è current color
        width: ctx.lineWidth,
    };

    ctx.save(); // salva il contesto del canvas
    if (eraserActive) {
        ctx.globalCompositeOperation = "destination-out"; // cancellare i pixel sotto al tratto disegnato
        ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
        ctx.globalCompositeOperation = "source-over"; // disegna sopra
        ctx.strokeStyle = segmento.color;
    }
    ctx.lineWidth = segmento.width;// spessore linea
    ctx.beginPath(); // nuovo percorso
    ctx.moveTo(lastPos.x, lastPos.y);// punto iniziale
    ctx.lineTo(pos.x, pos.y);// punto finale
    ctx.stroke();// disegna linea
    ctx.restore();// ripristina stato

    linee.push(segmento);// salva segmento
    inviaUpdateLavagna(segmento);
    lastPos = pos;

});

canvas.addEventListener("mouseup", () => {
    if (selectedImage) {
        inviaUpdateLavagna({ // invia aggiornaamenti su dimensione e posizione 
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

canvas.addEventListener("mouseout", () => { // ferma disegno se esce dal canvas
    drawing = false;
    lastPos = null;
    selectedImage = null;
    resizeStart = null;
    resizing = false;
});

// Ricezione
export function riceviUpdateLavagna(dati) {
    let obj;
    try {
        obj = typeof dati === "string" ? JSON.parse(dati) : dati; // se dati è stringa --> oggetto json
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
    // Ricezione immagini chunk
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
    // Aggiornamento immagine ridimensionata/spostata
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

// Pulsanti colore e clear
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

// Upload immagini
export function setupImageUpload() {
    const input = document.getElementById("image-upload");
    if (!input) return;

    input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => { // quando immagine è letta
            const img = new Image();
            const MAX_WIDTH = canvas.width - 20 ;   
            const MAX_HEIGHT = canvas.height - 20;

            img.onload = () => { // quando immagine è caricata
                let width = img.width;
                let height = img.height;

                // scala proporzionalmente senza ingrandire (al massimo vengono rimpicciolite)
                const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
                width = width * scale;
                height = height * scale;

                const imgObj = {
                    id: crypto.randomUUID(), // id univoco
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
        reader.readAsDataURL(file); // legge file e converte in stringa base64 --> scatena evento onload del reader
    });
}

//  Invio immagine in chunk
function inviaImmagineInChunk(imgObj) {
    const chunkSize = 16000; // byte di dimensione
    const src = imgObj.src; // dati immagine in base64
    for (let i = 0; i < src.length; i += chunkSize) { 
        const chunk = src.slice(i, i + chunkSize); // estrae pezzo grande massimo 16 KB
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
    const input = document.getElementById("image-upload");
    input.value = ""; // reset input --> per permettere invio di più immagini uguale
}

// Ridisegna tutto
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // immagini
    for (const img of immagini) {
        ctx.drawImage(img.image, img.x, img.y, img.width, img.height);

        // mostra maniglione se selezionata
        if (img === selectedImage) {
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(img.x + img.width - HANDLE_SIZE / 2, img.y + img.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        }
    }

    // linee sopra immagini
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

// Brush size
export function setupBrushSize() {
    const brushSizeInput = document.getElementById("brush-size");
    const brushSizeLabel = document.getElementById("brush-size-label");

    if (!brushSizeInput || !brushSizeLabel) return;

    brushSizeInput.addEventListener("input", () => {
        ctx.lineWidth = parseInt(brushSizeInput.value);
        brushSizeLabel.textContent = brushSizeInput.value;
    });
}

// Eraser buttons
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



// Array di immagini demo (puoi sostituire src con URL reali o base64)
const immaginiDemo = [
    { dim: "100", src: "./images/immagine_100KB.png", width: 100, height: 100 },
    { dim: "200", src: "./images/immagine_200KB.jpg", width: 200, height: 200 },
    { dim: "400", src: "./images/immagine_400KB.png", width: 300, height: 300 }
];

export async function caricaImm(grandezza) {
    console.log("spedita");
    // trova immagine demo corrispondente
    const demo = immaginiDemo.find(img => img.dim === grandezza);
    if (!demo) {
        console.error("Immagine demo non trovata:", grandezza);
        return;
    }

    const img = new Image();

    img.onload = () => {

        const MAX_WIDTH = canvas.width - 20;
        const MAX_HEIGHT = canvas.height - 20;

        let width = img.width;
        let height = img.height;


        // scala proporzionalmente se necessario
        const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
        width *= scale;
        height *= scale;

        const imgObj = {
            id: crypto.randomUUID(),
            image: img,
            x: 10,
            y: 10,
            width,
            height,
            src: demo.src, // sarà convertito sotto
        };

        // Aggiungi a lavagna
        immagini.push(imgObj);
        drawBoard();

        // Converti in base64 e invia in chunk
        const reader = new FileReader();
        reader.onload = () => {
            imgObj.src = reader.result; // salva il base64
            inviaImmagineInChunk(imgObj);
        };

        // carica il file come base64 tramite fetch + blob
        fetch(demo.src)
            .then(res => res.blob())
            .then(blob => reader.readAsDataURL(blob));
    };

    img.src = demo.src;
}



