import { boardChannel, chatChannel, quizChannel, connessione } from "./connessione.js";

// Variabile per lo stream locale (webcam + audio)
let localStream;

// Variabile per lo stream attualmente mostrato/inviato (può essere webcam o screen)
let currentStream;


// Variabili globali
let bitrateChart;
let chartInitialized = false;
let lastBytesSent = 0;
let lastTimestamp = 0;

// Funzione per avviare webcam e microfono
export async function startLocalVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    currentStream = localStream; 
    document.getElementById("local-video").srcObject = localStream;
    return localStream;
  } catch (err) {
    console.error("Impossibile accedere a webcam/microfono:", err);
  }
}

// Restituisce lo stream locale della webcam + audio
export function getLocalStream() {
  return localStream;
}

// Avvia lo screen share
export async function startScreenShare() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

    // Aggiorna lo stream corrente
    currentStream = screenStream;
    document.getElementById("local-video").srcObject = screenStream;

    // Sostituisci il track video e audio nella connessione peer
    const senderVideo = connessione.getSenders().find(s => s.track && s.track.kind === "video");
    const senderAudio = connessione.getSenders().find(s => s.track && s.track.kind === "audio");

    if (senderVideo) senderVideo.replaceTrack(screenStream.getVideoTracks()[0]);
    if (senderAudio && screenStream.getAudioTracks()[0]) {
      senderAudio.replaceTrack(screenStream.getAudioTracks()[0]); // se lo screen share ha audio
    }

    // Quando termina lo sharing, ripristina la webcam e microfono
    screenStream.getVideoTracks()[0].onended = () => stopScreenShare();

    // Aggiorna pulsante
    const shareButton = document.getElementById("btn-share-screen");
    const icon = shareButton.querySelector(".icon img");
    const label = shareButton.querySelector(".label");

    icon.src = "./images/condivisione_schermo.png";
    label.textContent = "Interrompi condivisione";
    shareButton.classList.add("share-off");

    return screenStream;

  } catch (err) {
    console.error("Errore nello sharing dello schermo:", err);
  }
}

// Interrompe lo screen share e ripristina webcam + microfono
export function stopScreenShare() {
  const localVideo = document.getElementById("local-video");
  if (!currentStream) return;

  // Ferma tutte le tracce video dello screen share
  currentStream.getTracks().forEach(track => track.stop());

  // Ripristina la webcam e l'audio del localStream
  if (localStream) {
    const senderVideo = connessione.getSenders().find(s => s.track && s.track.kind === "video");
    const senderAudio = connessione.getSenders().find(s => s.track && s.track.kind === "audio");

    if (senderVideo) senderVideo.replaceTrack(localStream.getVideoTracks()[0]);
    if (senderAudio) senderAudio.replaceTrack(localStream.getAudioTracks()[0]);

    currentStream = localStream;
    localVideo.srcObject = localStream;
  }

  // Aggiorna pulsante
  const shareButton = document.getElementById("btn-share-screen");
  const icon = shareButton.querySelector(".icon img");
  const label = shareButton.querySelector(".label");

  icon.src = "./images/condivisione_schermo.png";
  label.textContent = "Condividi schermo";
  shareButton.classList.remove("share-off");
}


// Cambia dinamicamente la qualità audio/video
export async function setQuality({ 
  bitrateVideo, // in bit per secondo 
  framerate, // in fps
  riduzioneRisoluzione, // fattore di riduzione
  bitrateAudio // in bit per secondo
}) {
  // Prendiamo i sender video e audio dalla connessione
  const senderVideo = connessione.getSenders().find(s => s.track && s.track.kind === "video");
  const senderAudio = connessione.getSenders().find(s => s.track && s.track.kind === "audio");

  // VIDEO
  if (senderVideo) {
    const params = senderVideo.getParameters();
    if (!params.encodings) params.encodings = [{}];
    const encoding = params.encodings[0]; // in encoding sono contenute le informazioni varie: bitrate, fps ecc..

    if (bitrateVideo !== undefined) encoding.maxBitrate = bitrateVideo;
    if (framerate !== undefined) encoding.maxFramerate = framerate;
    if (riduzioneRisoluzione !== undefined) encoding.scaleResolutionDownBy = riduzioneRisoluzione;

    try {
      await senderVideo.setParameters(params); // setta i parametri appena cambiati
    } catch (err) {
      console.error("Errore nell’impostare i parametri video:", err);
    }
  }

  // AUDIO
  if (senderAudio) {
    const params = senderAudio.getParameters();
    if (!params.encodings) params.encodings = [{}];
    const encoding = params.encodings[0];

    if (bitrateAudio !== undefined) encoding.maxBitrate = bitrateAudio;

    try {
      await senderAudio.setParameters(params);
    } catch (err) {
      console.error("Errore nell’impostare i parametri audio:", err);
    }
  }
}


let selectedStat = "bitrate"; // default

// Pulsanti per selezionare la statistica
document.querySelectorAll(".choose-stats .graph").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedStat = btn.dataset.stat;
    console.log(selectedStat)
    document.getElementById("title-graph").textContent = btn.textContent;
    // reset del grafico quando cambia statistica
    if (bitrateChart) {
      bitrateChart.data.labels = [];
      bitrateChart.data.datasets[0].data = [];
      bitrateChart.update();
    }
  });
});


export async function mostraStatistiche() {
  document.getElementById("all-stats-container").classList.remove("dis");

  const senderVideo = connessione.getSenders().find(s => s.track && s.track.kind === "video");
  if (!senderVideo) return console.warn("Nessun sender video trovato");

  // Inizializza grafico se non esiste
  if (!chartInitialized) {
    const ctx = document.getElementById("bitrateChart")?.getContext("2d");
    if (!ctx) return console.warn("Canvas bitrateChart non trovato nel DOM.");

    bitrateChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: selectedStat.toUpperCase(),
            data: [],
            borderColor: "#0078ff",
            backgroundColor: "rgba(0,120,255,0.2)",
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: { // per adattare il grafico alle dimensioni della finestra
        responsive: true,
        scales: {
          x: { title: { display: true, text: "Tempo (s)" } },
          y: { title: { display: true, text: selectedStat.toUpperCase() }, beginAtZero: true }
        },
        plugins: { legend: { display: true } }
      }
    });
    chartInitialized = true;
  }

  const stats = await connessione.getStats();

  // OTTIENI BANDA DISPONIBILE
  let estimatedBandwidth = 0; // in kbps
  stats.forEach(r => {
    if (r.type === "candidate-pair" && r.state === "succeeded" && r.availableOutgoingBitrate) {
      estimatedBandwidth = Math.round(r.availableOutgoingBitrate / 1000); // converto da bit al secondo a kbit al secondo
    }
  });

  // --- RTT
  let rttValue = 0;
  stats.forEach(r => {
    if (r.type === "candidate-pair" && r.state === "succeeded" && r.currentRoundTripTime) {
      rttValue = Math.round(r.currentRoundTripTime * 1000); // ms
    }
  });

  // --- BUFFERED AMOUNT (DataChannel)
  let bufferedAmountValue = 0;
  if (boardChannel && chatChannel && quizChannel) {
    bufferedAmountValue = boardChannel.bufferedAmount + chatChannel.bufferedAmount + quizChannel.bufferedAmount || 0;
  }


  //  OTTIENI STATISTICHE OUTBOUND RTP (dati in uscita)
  stats.forEach(report => {
    if (report.type === "outbound-rtp" && report.kind === "video" ) {
      if (lastTimestamp && report.timestamp !== lastTimestamp) {

        const deltaBytes = report.bytesSent - lastBytesSent;
        const deltaTime = (report.timestamp - lastTimestamp) / 1000; // sec
        const bitrate = deltaTime > 0 ? Math.round((deltaBytes * 8) / deltaTime / 1000) : 0; // kbps
        // controllo se deltaTime != 0
        const dataRate = calcolaDatarate(stats);

        let value;
        switch (selectedStat) {
          case "bitrate":
            value = bitrate;
            break;
          case "datarate":
            value = dataRate;
            break;
          case "fps":
            value = report.framesPerSecond || 0;
            break;
          case "bandwidth":
            value = bitrate;
            break;
          case "packetloss":
            value = packetLossPercent;
            break;
          case "bufferedamount":
            value = bufferedAmountValue; // bytes in coda
            break;
          case "rtt":
            value = rttValue; // ms
            break;
          default:
            value = 0;
        }

        const timeLabel = new Date().toLocaleTimeString().split(":").slice(1).join(":");
        bitrateChart.data.labels.push(timeLabel);

        if (selectedStat === "bandwidth") {
            // crea le due rige extra per la banda
            if (bitrateChart.data.datasets.length === 1) {
                bitrateChart.data.datasets.push({
                    label: "BANDA DISPONIBILE",
                    data: [],
                    borderColor: "#ff0000",
                    borderDash: [5, 5],
                    fill: false
                });
                bitrateChart.data.datasets.push({
                    label: "DATARATE",
                    data: [],
                    borderColor: "#00cc00",
                    fill: false
                });
            }

            // Aggiorna i dataset
            bitrateChart.data.datasets[0].label = "BANDA USATA";
            bitrateChart.data.datasets[0].data.push(bitrate);   // video

            bitrateChart.data.datasets[1].data.push(estimatedBandwidth); // banda max

            bitrateChart.data.datasets[2].data.push(dataRate); // datarate totale
        } else {
            // Rimuovi eventuali dataset extra se non serve la banda
            if (bitrateChart.data.datasets.length > 1) {
                bitrateChart.data.datasets.splice(1, bitrateChart.data.datasets.length - 1);
            }

            // Aggiorna il dataset principale
            bitrateChart.data.datasets[0].label = selectedStat.toUpperCase();
            bitrateChart.data.datasets[0].data.push(value);
        }


        // Limita a 20 punti
        if (bitrateChart.data.labels.length > 20) {
          bitrateChart.data.labels.shift();
          bitrateChart.data.datasets.forEach(ds => ds.data.shift());
        }

        // Aggiorna titolo asse Y
        bitrateChart.options.scales.y.title.text = selectedStat === "bandwidth" ? "BANDA / DATARATE (kbps)" : selectedStat.toUpperCase();
        bitrateChart.update();
      }

      // Salva ultimi valori per delta
      lastBytesSent = report.bytesSent;
      lastTimestamp = report.timestamp;
    }
  });

  setTimeout(mostraStatistiche, 1000);
}

// Oggetto globale per memorizzare i precedenti byte inviati per ogni id
const lastStats = {}; 

function calcolaDatarate(stats) {
    let totalBytes = 0;
    const now = Date.now();

    stats.forEach(report => {
        // Considera solo outbound
        if ((report.type === "outbound-rtp" && (report.kind === "video" || report.kind === "audio")) 
            || report.type === "data-channel") {
            
            const id = report.id || report.ssrc || report.label || Math.random(); // identificatore unico
            const last = lastStats[id] || { bytesSent: 0, timestamp: now };
            
            const deltaBytes = (report.bytesSent || 0) - last.bytesSent;
            const deltaTime = ((report.timestamp || now) - last.timestamp) / 1000; // secondi
            
            if (deltaTime > 0) {
                totalBytes += deltaBytes;
            }

            // Salva per prossimo calcolo
            lastStats[id] = {
                bytesSent: report.bytesSent || 0,
                timestamp: report.timestamp || now
            };
        }
    });

    // Converti da bytes/sec a kbps
    const datarateKbps = Math.round((totalBytes) * 8 / 1000);


    return datarateKbps ;
}
