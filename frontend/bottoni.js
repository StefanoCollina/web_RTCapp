import { connessione, socket } from './connessione.js';
import { resetApp } from "./inizio.js";
import { getLocalStream } from "./richiesta_audioVideo.js"; 

const micButton = document.getElementById("btn-toggle-mic");
const camButton = document.getElementById("btn-toggle-cam");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const invioChiamata = document.getElementById("btn-start-call");

/**
 * Attiva o disattiva il microfono della webcam
 */
export function attivaDisattivaMic() {
  const localStream = getLocalStream(); // Sempre webcam
  if (!localStream) {
    console.warn("Local stream non disponibile!");
    return;
  }

  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length === 0) {
    console.log("Microfono non disponibile");
    return;
  }

  const isMuted = !audioTracks[0].enabled;
  audioTracks.forEach(track => track.enabled = isMuted);

  const icon = micButton.querySelector(".icon img");
  const label = micButton.querySelector(".label");

  if (!isMuted) {
    micButton.classList.add("muted");
    icon.src = "./images/microfono_mutato.png";
    label.textContent = "Riattiva microfono";
  } else {
    micButton.classList.remove("muted");
    icon.src = "./images/microfono_mutato.png";
    label.textContent = "Muta microfono";
  }
}

/**
 * Attiva o disattiva la videocamera dello stream corrente
 */
export function attivaDisattivaCam() {
  const currentStream = localVideo.srcObject;
  if (!currentStream) {
    console.warn("Nessuno stream attivo!");
    return;
  }

  const videoTracks = currentStream.getVideoTracks();
  if (videoTracks.length === 0) return;

  const isCamOn = !videoTracks[0].enabled;
  videoTracks.forEach(track => track.enabled = isCamOn);

  const icon = camButton.querySelector(".icon img");
  const label = camButton.querySelector(".label");

  if (isCamOn) {
    camButton.classList.remove("cam-off");
    icon.src = "./images/webcam_mutata.png";
    label.textContent = "Disattiva videocamera";
  } else {
    camButton.classList.add("cam-off");
    icon.src = "./images/webcam_mutata.png";
    label.textContent = "Attiva videocamera";
  }
}

/**
 * Termina la chiamata
 */
export function terminaChiamata() {
  const localStream = getLocalStream();

  // Stoppa tutti i track locali (audio + video)
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  // Rimuovi i video dal DOM
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;


  // Invia messaggio all’altro peer
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "termina" }));
  }

  // Chiudi la connessione peer
  if (connessione) {
    try {
      connessione.close();
    } catch (err) {
      console.error("Errore durante close():", err);
    }
  }

  // Chiudi il WebSocket se esiste
  if (socket) {
    socket.close();
  }

  // Reset bottone chiamata
  invioChiamata.classList.remove("termina");

  // Reset app
  resetApp();

}

/**
 * Disabilita un bottone (aggiunge classe hidden)
 */
export function disabilitaBottone(bottone) {
  bottone.classList.add("hidden");
}
