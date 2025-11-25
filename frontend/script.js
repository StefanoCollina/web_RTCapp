import { startCall, ready } from './connessione.js';
import { startLocalVideo, startScreenShare, stopScreenShare, setQuality, mostraStatistiche } from './richiesta_audioVideo.js';
import { attivaDisattivaMic, attivaDisattivaCam, terminaChiamata, disabilitaBottone } from './bottoni.js';
import { inviaMessaggio } from "./chat.js";
import { caricaImm } from "./lavagna.js";

const invioChiamata = document.getElementById("btn-start-call");
const turnOn = document.getElementById("btn-turnOn");
const creaPartecipa = document.getElementById("btn-crea-partecipa");
const ShareScreen = document.getElementById("btn-share-screen");
const toggleChatBtn = document.getElementById('chat-toggle-btn');
const chatSidebar = document.getElementById('chat-sidebar');
const mic = document.getElementById('btn-toggle-mic');
const cam = document.getElementById('btn-toggle-cam');

const btnChange = document.getElementById("btn-change-resolution");
const dropdown = document.getElementById("resolution-dropdown");
const btnAdvanced = document.getElementById("btn-advanced-settings");
const advancedPanel = document.getElementById("advanced-settings");

const muteMic = document.getElementById("btn-toggle-mic");
const muteCam = document.getElementById("btn-toggle-cam");

export let localS;
let share = false;

function abilita(btn) {
  btn.disabled = false;
}

/* Screen share */
ShareScreen.addEventListener('click', async () => {
  if (!share) {
    localS = await startScreenShare();
    share = true;
    ShareScreen.classList.toggle('shared');
    if (creaPartecipa.classList.contains("hidden")) abilita(invioChiamata);
  } else {
    share = false;
    stopScreenShare();
  }
});

/* Chat toggle */
toggleChatBtn.addEventListener('click', () => {
  chatSidebar.classList.toggle('open');
});

/* Start local video */
turnOn.addEventListener("click", async () => {
  localS = await startLocalVideo();
  disabilitaBottone(turnOn);

  muteCam.disabled = false;
  muteMic.disabled = false;

  if (creaPartecipa.classList.contains("hidden")) {
    abilita(invioChiamata);
    mic.classList.add('on');
    cam.classList.add('on');
  }
});

/* Create/Join room */
creaPartecipa.addEventListener("click", async () => {
  let socket = await ready();
  disabilitaBottone(creaPartecipa);
  document.getElementById("nome-stanza").classList.remove("dis");

  if (turnOn.classList.contains("hidden")) abilita(invioChiamata);
});

/* Start/End call */
invioChiamata.addEventListener("click", async () => {
  if (!invioChiamata.classList.contains("termina") && !invioChiamata.classList.contains("wait")) {
    await startCall();
  } else if (invioChiamata.classList.contains("termina")) {
    terminaChiamata(localS);
  }
});

/* Toggle mic/cam */
mic.addEventListener("click", async () => attivaDisattivaMic(localS));
cam.addEventListener("click", async () => attivaDisattivaCam(localS));

/* Chat send */
document.getElementById("chat-send-btn").addEventListener("click", async () => inviaMessaggio());

/* Brush size tool */
export function setupBrushSize() {
  const brushSizeInput = document.getElementById("brush-size");
  const brushSizeLabel = document.getElementById("brush-size-label");
  if (!brushSizeInput || !brushSizeLabel) return;

  brushSizeInput.addEventListener("input", () => {
    ctx.lineWidth = parseInt(brushSizeInput.value);
    brushSizeLabel.textContent = brushSizeInput.value;
  });
}

/* Resolution dropdown */
btnChange.addEventListener("click", () => {
  dropdown.classList.toggle("hidden");
  advancedPanel.classList.add("hidden");
});

/* Advanced settings toggle */
btnAdvanced.addEventListener("click", () => {
  advancedPanel.classList.toggle("hidden");
});

/* Preset quality options */
document.querySelectorAll(".preset").forEach(btn => {
  btn.addEventListener("click", () => {
    const quality = btn.dataset.quality;

    if (quality === "low") {
      setQuality({
        bitrateVideo: 200000, //200 kbps
        framerate: 15,
        riduzioneRisoluzione: 2,
        bitrateAudio: 32000
      });
    } else if (quality === "medium") {
      setQuality({
        bitrateVideo: 700000,
        framerate: 24,
        riduzioneRisoluzione: 1.5,
        bitrateAudio: 64000
      });
    } else if (quality === "high") {
      setQuality({
        bitrateVideo: 1500000,
        framerate: 30,
        riduzioneRisoluzione: 1,
        bitrateAudio: 128000
      });
    }

    dropdown.classList.add("hidden");
  });
});

/* Apply custom quality */
document.getElementById("apply-custom-quality").addEventListener("click", () => {
  const bitrateVideo = Number(document.getElementById("video-bitrate").value) * 1000;
  const framerate = Number(document.getElementById("video-framerate").value);
  const riduzioneRisoluzione = Number(document.getElementById("scale-down").value);
  const bitrateAudio = Number(document.getElementById("audio-bitrate").value) * 1000;

  setQuality({ bitrateVideo, framerate, riduzioneRisoluzione, bitrateAudio });
  dropdown.classList.add("hidden");
});

/* Statistics */
document.getElementById("btn-stats").addEventListener("click", () => {
  mostraStatistiche();
});


let simulationInterval = null;

document.getElementById("start-simulation").addEventListener("click", () => {
    // Legge il radio selezionato per frequenza
    const freqRadio = document.querySelector('input[name="freq"]:checked');
    // Legge il radio selezionato per grandezza immagine
    const sizeRadio = document.querySelector('input[name="size"]:checked');

    // Controlla se entrambi sono selezionati
    if (!freqRadio || !sizeRadio) {
        alert("Seleziona sia la frequenza che la grandezza dell'immagine prima di iniziare la simulazione!");
        return; // esce dalla funzione, non fare nulla
    }
    document.getElementById("start-simulation").disabled = true;
    document.getElementById("end-simulation").disabled = false;

    const frequenza = freqRadio.value;
    const grandezza = sizeRadio.value;

    simulationInterval = setInterval(() => {
        caricaImm(grandezza);
    }, 1000/frequenza);




});

document.getElementById("end-simulation").addEventListener("click", () => {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }

    document.getElementById("start-simulation").disabled = false;
    document.getElementById("end-simulation").disabled = true;
  

})
