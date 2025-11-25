// connessione.js
import { resetApp } from "./inizio.js";
import { localS } from "./script.js";
import { riceviMessaggio } from "./chat.js";
import { setupBoardChannel, setupColorButtons, setupImageUpload, setupBrushSize, setupEraserButtons } from './lavagna.js';

export const connessione = new RTCPeerConnection();
export let socket;
export let chatChannel;
export let boardChannel;
export let quizChannel;

let stanza;

const invioChiamata = document.getElementById("btn-start-call");
const remoteVideo = document.getElementById("remote-video");
const localVideo = document.getElementById("local-video");
const btnStanza = document.getElementById("btn-crea-partecipa");
const nomeStanzaInput = document.getElementById("nomeStanza");

const shareScreen = document.getElementById("btn-share-screen");
const muteMic = document.getElementById("btn-toggle-mic");
const muteCam = document.getElementById("btn-toggle-cam");
const viewStat = document.getElementById("btn-stats");
const res = document.getElementById("btn-change-resolution");

// Remote video
connessione.ontrack = event => { //quando riceve dal peer una traccia media
  invioChiamata.disabled = false;
  const icon = invioChiamata.querySelector(".icon img");
  const label = invioChiamata.querySelector(".label");
  invioChiamata.classList.add("termina");
  icon.src = "./images/fine_chiamata.png";
  label.textContent = "Termina Chiamata";

  if (remoteVideo.srcObject !== event.streams[0]) { //se lo stream che arriva è diverso da quello precedente
    remoteVideo.srcObject = event.streams[0];
  }
};

// DataChannel: chat
function creaDataChannel() {
  chatChannel = connessione.createDataChannel("chat");
  chatChannel.onmessage = (event) => riceviMessaggio(event.data); // associata la callback riceviMessaggio alla ricezione messaggio
  return chatChannel;
}

// DataChannel: lavagna
function creaBoardChannel() {
  boardChannel = connessione.createDataChannel("lavagna");
  return boardChannel;
}

// DataChannel: quiz
function creaQuizChannel() {
  quizChannel = connessione.createDataChannel("quiz");
  quizChannel.onmessage = (e) => handleQuizMessage(JSON.parse(e.data)); // associata la callback handleQuizMessage alla ricezione messaggio
  return quizChannel;
}

// Connessione server
export async function ready() {
  stanza = nomeStanzaInput.value.trim();
  if (!stanza) {
    alert("Inserisci un nome per la stanza");
    return;
  }

  btnStanza.classList.add("hidden");
  nomeStanzaInput.classList.add("hidden");

  socket = new WebSocket(location.origin.replace(/^http/, "ws")); // ogni client apre websocket con server --> per signaling

  socket.onopen = () => {
    socket.send(JSON.stringify({ type: "join", stanza }));
    document.getElementById("nome-stanza").textContent = "Nome stanza: " + stanza;
  };

  socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message); // associata la callback handleMessage alla ricezione messaggio dalla socket
  };

  return socket;
}

// Start call
export async function startCall() {
  if (!localS) return;

  shareScreen.disabled = false;
  muteCam.disabled = false;
  muteMic.disabled = false;
  viewStat.disabled = false;
  res.disabled = false;
  invioChiamata.disabled = false;

  localS.getTracks().forEach(track => connessione.addTrack(track, localS)); // aggiungo le tracce locali alla connessione 

  chatChannel  = creaDataChannel();
  boardChannel = creaBoardChannel();
  quizChannel  = creaQuizChannel();

  setupBoardChannel(boardChannel); 
  setupColorButtons();
  setupImageUpload();
  setupBrushSize();
  setupEraserButtons();

  const icon = invioChiamata.querySelector(".icon img");
  const label = invioChiamata.querySelector(".label");
  invioChiamata.classList.add("termina");
  icon.src = "./images/fine_chiamata.png";
  label.textContent = "Termina Chiamata";

  const offer = await connessione.createOffer(); //creazione offerta contentente informazioni per la connessione
  await connessione.setLocalDescription(offer); //settaggio delle informazioni locali
  sendToPeer("offer", offer);
}

// Quiz message handler
function handleQuizMessage(msg) {
  switch(msg.type) {
    case "quiz-send":
      window.dispatchEvent(new CustomEvent("quiz_received", { detail: msg.quiz })); // creo un evento globale quiz_received
      break;
    case "quiz-answer":
      window.dispatchEvent(new CustomEvent("quiz_answer", { detail: msg.answer }));
      break;
    default:
      console.warn("Messaggio quiz sconosciuto:", msg);
  }
}

// Gestione messaggi WebSocket
export async function handleMessage(message) {
  if (message.type === "offer") { // peer remoto che riceve chiamata

    if (localS) localS.getTracks().forEach(track => connessione.addTrack(track, localS)); // aggiunge le sue tracce alla connessione

    shareScreen.disabled = false;
    viewStat.disabled = false;
    res.disabled = false;

    connessione.ondatachannel = (event) => { // setup dei vari canali
      if (event.channel.label === "lavagna") {
        boardChannel = event.channel;
        boardChannel.onopen = () => {
          setupBoardChannel(boardChannel);
          setupColorButtons();
          setupImageUpload();
          setupBrushSize();
          setupEraserButtons();
        };
      }

      if (event.channel.label === "chat") {
        chatChannel = event.channel;
        chatChannel.onmessage = (e) => riceviMessaggio(e.data);
      }

      if (event.channel.label === "quiz") {
        quizChannel = event.channel;
        quizChannel.onopen = () => console.log("Canale quiz aperto (remote)");
        quizChannel.onmessage = (e) => {
          handleQuizMessage(JSON.parse(e.data));
        };
      }
    };

    await connessione.setRemoteDescription(message.data); // settaggio delle informazioni remote
    const answer = await connessione.createAnswer(); // creazione risposta con le informazioni locali
    await connessione.setLocalDescription(answer); // settagio info locali
    sendToPeer("answer", answer);

  } else if (message.type === "answer") { // peer locale che chiama
    await connessione.setRemoteDescription(message.data); // settaggio info remote 

  } else if (message.type === "candidate") { 
    await connessione.addIceCandidate(message.data); // aggiunta di un possibile ICE candidate

  } else if (message.type === "termina") {
    alert("L’altro peer ha chiuso la chiamata");
    stop();

  } else if (message.type === "joined") { // appena entri nella stanza ricevi un ruolo: PROFESSORE o ALUNNO
    const { ruolo } = message;
    window.myRole = ruolo;

    if (window.myRole === "professore") {
      setUpProfessore();
    } else if (window.myRole === "alunno") {
      setUpAlunno();
    }

    document.getElementById("nome-ruolo").classList.remove("dis");
    document.getElementById("nome-ruolo").textContent = "Ruolo attuale: " + myRole;

  } else if (message.type === "error") {
    alert("Stanza già piena!");
    resetApp();
  }
}

// ICE candidates
connessione.onicecandidate = event => { // si attiva ogni volta che viene trovato un candidate
  if (event.candidate) sendToPeer("candidate", event.candidate);
};

// Invia messaggi al peer
function sendToPeer(type, data) {
  socket.send(JSON.stringify({ type, data }));
}

// Stop chiamata
export function stop() {
  if (localS) localS.getTracks().forEach(track => track.stop()); // termina tutte le tracce media locali

  localVideo.srcObject = null; // rimuove lo stream locale dall'elemento video
  remoteVideo.srcObject = null;

  if (connessione) {
    try { connessione.close(); } // chiudi la RTCPeerConnection
    catch (err) { console.error("Errore durante close():", err); }
  }

  if (socket) { socket.close(); socket = null; } // chiudi websocket con server

  resetApp();
}

// Quiz: invio quiz
export function sendQuizToPeer(quizData) {
  if (quizChannel?.readyState === "open") { // condizione vera se il canale c'è ed è pronto
    quizChannel.send(JSON.stringify({
      type: "quiz-send",
      quiz: quizData
    }));
  } else {
    setTimeout(() => sendQuizToPeer(quizData), 100); // riprova a mandare il quiz dopo 100ms
  }
}

// Quiz: invio risposta
export function sendQuizAnswerToPeer(answerObj) { // mandi la risposta da alunno a professore
  if (!quizChannel) return;

  const sendMsg = () => {
    quizChannel.send(JSON.stringify({
      type: "quiz-answer",
      answer: answerObj
    }));
  };

  if (quizChannel.readyState === "open") {
    sendMsg();
  } else {
    quizChannel.onopen = sendMsg;
  }
}

// UI elementi quiz
const wrapper = document.getElementById("quiz-wrapper");
const question_area = document.getElementById("questions-area");
const quiz_cont = document.getElementById("quiz-container");
const quest_title = document.getElementById("question-title");
const quest_text = document.getElementById("question-text");
const quest_blk = document.getElementById("question-block");
const ans = document.getElementById("question-answer");
const add = document.getElementById("add-question-btn");
const send = document.getElementById("send-quiz-btn");
const result = document.getElementById("quiz-result");
const result_text = document.getElementById("quiz-result-text");
const prev = document.getElementById("quiz-preview");
const prev_list = document.getElementById("preview-list");

// Set up UI professore
function setUpProfessore() {
  wrapper.classList.remove("dis");
  question_area.classList.remove("dis");
  quiz_cont.classList.remove("dis");
  quest_title.classList.remove("dis");
  quest_text.classList.remove("dis");
  add.classList.remove("dis");
  send.classList.remove("dis");
  result.classList.remove("dis");
  result_text.classList.remove("dis");
  prev.classList.remove("dis");
  prev_list.classList.remove("dis");
  quest_blk.classList.remove("dis");
  ans.classList.remove("dis");
}

// Set up UI alunno
function setUpAlunno() { }
