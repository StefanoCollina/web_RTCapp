import { startCall, ready } from './connessione.js';
import { startLocalVideo, startScreenShare, stopScreenShare, setQuality, mostraStatistiche } from './richiesta_audioVideo.js';
import { attivaDisattivaMic, attivaDisattivaCam, terminaChiamata, disabilitaBottone } from './bottoni.js';
import { inviaMessaggio } from "./chat.js";

const invioChiamata = document.getElementById("btn-start-call");
const turnOn = document.getElementById("btn-turnOn");
const creaPartecipa = document.getElementById("btn-crea-partecipa");
const ShareScreen = document.getElementById("btn-share-screen");
const toggleChatBtn = document.getElementById('chat-toggle-btn');
const chatSidebar = document.getElementById('chat-sidebar');
const mic = document.getElementById('btn-toggle-mic');
const cam = document.getElementById('btn-toggle-cam');

// Pulsante e tendina qualità video
const btnChange = document.getElementById("btn-change-resolution");
const dropdown = document.getElementById("resolution-dropdown");
const btnAdvanced = document.getElementById("btn-advanced-settings");
const advancedPanel = document.getElementById("advanced-settings");


const muteMic = document.getElementById("btn-toggle-mic");
const muteCam = document.getElementById("btn-toggle-cam");


export let localS;
let socket;
let share = false;

// Utility per riattivare un bottone
function abilita(btn) {
  btn.disabled = false;
}

// === SCREEN SHARE ===
ShareScreen.addEventListener('click', async () => {
  if (!share) { // se non stai condividendo
    localS = await startScreenShare();
    share = true;
    ShareScreen.classList.toggle('shared');
    if (creaPartecipa.classList.contains("hidden")) abilita(invioChiamata);
  } else {
    share = false;
    stopScreenShare();
  }
});

// === CHAT ===
toggleChatBtn.addEventListener('click', () => {
  chatSidebar.classList.toggle('open');
});

// === AVVIA VIDEO ===
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

// === CREA / PARTECIPA ===
creaPartecipa.addEventListener("click", async () => {
  socket = await ready();
  disabilitaBottone(creaPartecipa);
  document.getElementById("nome-stanza").classList.remove("dis");
  
  if (turnOn.classList.contains("hidden")) abilita(invioChiamata);
});

// === AVVIA / TERMINA CHIAMATA ===
invioChiamata.addEventListener("click", async () => {
  if (!invioChiamata.classList.contains("termina") && !invioChiamata.classList.contains("wait")) {
    await startCall();
  } else if (invioChiamata.classList.contains("termina")) {
    terminaChiamata(localS);
  }
});

// === MICROFONO E CAMERA ===
mic.addEventListener("click", async () => attivaDisattivaMic(localS));
cam.addEventListener("click", async () => attivaDisattivaCam(localS));

// === CHAT INVIO MESSAGGIO ===
document.getElementById("chat-send-btn").addEventListener("click", async () => inviaMessaggio());

// === STRUMENTO DISEGNO ===
export function setupBrushSize() {
  const brushSizeInput = document.getElementById("brush-size");
  const brushSizeLabel = document.getElementById("brush-size-label");
  if (!brushSizeInput || !brushSizeLabel) return;

  brushSizeInput.addEventListener("input", () => {
    ctx.lineWidth = parseInt(brushSizeInput.value);
    brushSizeLabel.textContent = brushSizeInput.value;
  });
}

// === MENU CAMBIO RISOLUZIONE ===

// Apri/chiudi la tendina
btnChange.addEventListener("click", () => {
  dropdown.classList.toggle("hidden");
  advancedPanel.classList.add("hidden"); // chiudi il pannello avanzato se aperto
});

// Apri/chiudi impostazioni avanzate
btnAdvanced.addEventListener("click", () => {
  advancedPanel.classList.toggle("hidden");
});

// Click sui preset di qualità
document.querySelectorAll(".preset").forEach(btn => {
  btn.addEventListener("click", () => {
    const quality = btn.dataset.quality;
    if (quality === "low") {
      setQuality({
        bitrateVideo: 200_000,       // 200 kbps
        framerate: 15,
        riduzioneRisoluzione: 2,
        bitrateAudio: 32_000
      });
    } else if (quality === "medium") {
      setQuality({
        bitrateVideo: 700_000,       // 700 kbps
        framerate: 24,
        riduzioneRisoluzione: 1.5,
        bitrateAudio: 64_000
      });
    } else if (quality === "high") {
      setQuality({
        bitrateVideo: 1_500_000,     // 1.5 Mbps
        framerate: 30,
        riduzioneRisoluzione: 1,
        bitrateAudio: 128_000
      });
    }

    dropdown.classList.add("hidden");
  });
});

// Applica impostazioni manuali
document.getElementById("apply-custom-quality").addEventListener("click", () => {
  const bitrateVideo = Number(document.getElementById("video-bitrate").value) * 1000;
  const framerate = Number(document.getElementById("video-framerate").value);
  const riduzioneRisoluzione = Number(document.getElementById("scale-down").value);
  const bitrateAudio = Number(document.getElementById("audio-bitrate").value) * 1000;

  setQuality({ bitrateVideo, framerate, riduzioneRisoluzione, bitrateAudio });
  dropdown.classList.add("hidden");
});



document.getElementById("btn-stats").addEventListener("click", () => {

  mostraStatistiche();
})

