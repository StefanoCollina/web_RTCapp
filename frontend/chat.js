// chat.js
import { chatChannel } from './connessione.js';

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");



// Ricezione messaggio
export function riceviMessaggio(testo) {
  aggiungiMessaggio("Altro utente", testo);
}

// Aggiunge un messaggio nel div chat
export function aggiungiMessaggio(mittente, testo) {
  const msg = document.createElement("div");
  msg.classList.add("chat-message");
  msg.innerHTML = `<strong>${mittente}:</strong> ${testo}`;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight; // scroll automatico
}

// Invio messaggio
export function inviaMessaggio() {
  const testo = chatInput.value.trim();
  if (!testo || !chatChannel || chatChannel.readyState !== "open") return;

  
  // Mostra nel div locale
  aggiungiMessaggio("Me", testo);

  // Invia al peer
  chatChannel.send(testo);

  chatInput.value = "";
}

// Event listener pulsante
chatSendBtn.addEventListener("click", inviaMessaggio);

// Event listener invio con Enter
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") inviaMessaggio();
});
