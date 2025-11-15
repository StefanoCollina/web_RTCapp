// connessione.js
import { resetApp } from "./inizio.js";
import { localS } from "./script.js";
import { riceviMessaggio } from "./chat.js";
import { setupBoardChannel, setupColorButtons, setupImageUpload, setupBrushSize, setupEraserButtons } from './lavagna.js';

export const connessione = new RTCPeerConnection();
export let socket;

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




let stanza;

export let chatChannel;
export let boardChannel;
export let quizChannel;


// ----------------- Gestione video remoto -----------------
connessione.ontrack = event => {
  invioChiamata.disabled = false;
  const icon = invioChiamata.querySelector(".icon img");
  const label = invioChiamata.querySelector(".label");
  invioChiamata.classList.add("termina");
  icon.src = "./images/fine_chiamata.png";
  label.textContent = "Termina Chiamata";



  if (remoteVideo.srcObject !== event.streams[0]) {
    remoteVideo.srcObject = event.streams[0];
  }
};

// ----------------- ICE Candidates -----------------
connessione.onicecandidate = event => {
  if (event.candidate) sendToPeer("candidate", event.candidate);
};

// ----------------- Creazione DataChannel -----------------
function creaDataChannel() {
  chatChannel = connessione.createDataChannel("chat");
  chatChannel.onopen = () => console.log("Canale chat aperto");
  chatChannel.onmessage = (event) => riceviMessaggio(event.data);
  return chatChannel;
}

function creaBoardChannel() {
  boardChannel = connessione.createDataChannel("lavagna");
  return boardChannel;
}

function creaQuizChannel() {
  quizChannel = connessione.createDataChannel("quiz");

  // Callback subito disponibile
  quizChannel.onopen = () => console.log("Canale quiz aperto (professore)");
  quizChannel.onmessage = (e) => {
      console.log("Messaggio quiz ricevuto raw:", e.data);
      handleQuizMessage(JSON.parse(e.data));
  };

  return quizChannel;
}

// ----------------- Connessione al server -----------------
export async function ready() {
  stanza = nomeStanzaInput.value.trim();
  if (!stanza) {
    alert("Inserisci un nome per la stanza");
    return;
  }

  btnStanza.classList.add("hidden");
  nomeStanzaInput.classList.add("hidden");

  socket = new WebSocket(location.origin.replace(/^http/, "ws"));

  socket.onopen = () => {
    socket.send(JSON.stringify({ type: "join", stanza }));
    document.getElementById("nome-stanza").textContent = "Nome stanza: " + stanza;
  };

  socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
  };

  return socket;
}

// ----------------- Start call -----------------
export async function startCall() {


  if (!localS) return;

  shareScreen.disabled = false;
  muteCam.disabled = false;
  muteMic.disabled = false;
  viewStat.disabled = false;
  res.disabled = false;

  localS.getTracks().forEach(track => connessione.addTrack(track, localS));

  // Creazione DataChannel
  chatChannel  = creaDataChannel();
  boardChannel = creaBoardChannel();
  quizChannel = creaQuizChannel()

  // configurazione
  setupBoardChannel(boardChannel); 
  setupColorButtons();
  setupImageUpload();
  setupBrushSize();
  setupEraserButtons()

  invioChiamata.disabled = false;
  invioChiamata.classList.remove("wait");
  const icon = invioChiamata.querySelector(".icon img");
  const label = invioChiamata.querySelector(".label");
  invioChiamata.classList.add("termina");
  icon.src = "./images/fine_chiamata.png";
  label.textContent = "Termina Chiamata";

  const offer = await connessione.createOffer();
  await connessione.setLocalDescription(offer);
  sendToPeer("offer", offer);
}

function handleQuizMessage(msg) {
  switch(msg.type) {
    case "quiz-send":
      console.log("quiz send ricevuto");
      window.dispatchEvent(new CustomEvent("quiz_received", { detail: msg.quiz }));
      break;
    case "quiz-answer":
      console.log("quiz answer ricevuto");
      window.dispatchEvent(new CustomEvent("quiz_answer", { detail: msg.answer }));
      break;
    default:
      console.warn("Messaggio quiz sconosciuto:", msg);
  }
}


// ----------------- Gestione messaggi -----------------
export async function handleMessage(message) {
  if (message.type === "offer") {
    if (localS) localS.getTracks().forEach(track => connessione.addTrack(track, localS));
    else console.warn("Nessun localStream disponibile nel peer remoto!");

    shareScreen.disabled = false;
    viewStat.disabled = false;
    res.disabled = false;

    connessione.ondatachannel = (event) => {
      if(event.channel.label === "lavagna") {
        boardChannel = event.channel;
        boardChannel.onopen = () => {
          setupBoardChannel(boardChannel);
          setupColorButtons();
          setupImageUpload();
          setupBrushSize();
          setupEraserButtons()
        };
        
      }
      if(event.channel.label === "chat") {
        chatChannel = event.channel;
        chatChannel.onmessage = (e) => riceviMessaggio(e.data);
      }
      if (event.channel.label === "quiz") {
        quizChannel = event.channel;
        quizChannel.onopen = () => console.log("Canale quiz aperto (remote)");
        quizChannel.onmessage = (e) => {
            console.log("Messaggio quiz ricevuto raw:", e.data);
            handleQuizMessage(JSON.parse(e.data));
        };      
      }
    };

    await connessione.setRemoteDescription(message.data);
    const answer = await connessione.createAnswer();
    await connessione.setLocalDescription(answer);
    sendToPeer("answer", answer);

  } else if (message.type === "answer") {
    console.log("ricevuta l'answer");
    await connessione.setRemoteDescription(message.data);

  } else if (message.type === "candidate") {
    await connessione.addIceCandidate(message.data);

  } else if (message.type === "termina") {
    alert("L’altro peer ha chiuso la chiamata");
    stop();
  } else if (message.type === "joined") {
    const { ruolo } = message;
    // Salvo in una variabile globale o in un modulo condiviso
    window.myRole = ruolo;

    if(window.myRole === "professore"){
      setUpProfessore();
    }else if(window.myRole === "alunno"){
      setUpAlunno();
    }

    //rendo visibile il ruolo
    document.getElementById("nome-ruolo").classList.remove("dis");
    document.getElementById("nome-ruolo").textContent = "Ruolo attuale: " + myRole;
  } else if (message.type === "error"){
    alert("Stanza già piena!");

    resetApp();
  } 
  
}

// ----------------- Invio messaggi al peer -----------------
function sendToPeer(type, data) {
  socket.send(JSON.stringify({ type, data }));
}

// ----------------- Stop chiamata -----------------
export function stop() {
  if (localS) localS.getTracks().forEach(track => track.stop());

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;

  if (connessione) {
    try { connessione.close(); console.log("Connessione chiusa correttamente"); }
    catch (err) { console.error("Errore durante close():", err); }
  }

  if (socket) { socket.close(); socket = null; }

  resetApp();
  console.log("Chiamata terminata");
}


/*--------------quiz----------------*/


export function sendQuizToPeer(quizData) {
  if (quizChannel?.readyState === "open") {
    quizChannel.send(JSON.stringify({
      type: "quiz-send",
      quiz: quizData
    }));
    console.log("Quiz inviato:", quizData);
  } else {
    console.warn("QuizChannel non aperto, ritento tra 100ms");
    setTimeout(() => sendQuizToPeer(quizData), 100);
  }
}

export function sendQuizAnswerToPeer(answerObj) {
  if (!quizChannel) {
    console.error("quizChannel non disponibile!");
    return;
  }

  const sendMsg = () => {
    quizChannel.send(JSON.stringify({
      type: "quiz-answer",
      answer: answerObj
    }));
    console.log("Messaggio quiz-answer inviato:", answerObj);
  };

  if (quizChannel.readyState === "open") {
    sendMsg();
  } else {
    console.log("quizChannel non aperto, attendo apertura...");
    quizChannel.onopen = sendMsg;
  }
}


/*----------------Set Up iniziale-----------------*/









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


function setUpProfessore(){
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

function setUpAlunno(){

}
