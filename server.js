import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Servi i file statici nella cartella /frontend
app.use(express.static("frontend"));

// Oggetto per tenere traccia delle stanze e dei socket
const rooms = {};

wss.on("connection", (ws) => {
  console.log("Nuovo client connesso");

  ws.on("message", (msg) => {
    const message = JSON.parse(msg);

    // ===== Gestione join stanza =====
    if (message.type === "join") {
      const stanza = message.stanza;

      if (!stanza) {
        ws.send(JSON.stringify({ type: "error", msg: "Nome stanza richiesto" }));
        return;
      }

      if (!rooms[stanza]) rooms[stanza] = [];

      let ruolo = rooms[stanza].length === 0 ? "professore" : "alunno";

      if (rooms[stanza].length >= 2) {
        ws.send(JSON.stringify({ type: "error", msg: "Stanza piena" }));
        return;
      }

      rooms[stanza].push(ws);
      ws.stanza = stanza;

      ws.send(JSON.stringify({ type: "joined", stanza, ruolo })); // <-- invia ruolo

      // Se ci sono due utenti, notifico entrambi che possono iniziare
      if (rooms[stanza].length === 2) {
        rooms[stanza].forEach(peer => {
          peer.send(JSON.stringify({ type: "ready" }));
        });
      }
      return;
    }

    // ===== Forward dei messaggi signaling solo ai membri della stanza =====
    if (["offer", "answer", "candidate", "termina"].includes(message.type)) {
      const peers = rooms[ws.stanza]?.filter(peer => peer !== ws) || [];
      peers.forEach(peer => peer.send(JSON.stringify(message)));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnesso");

    const stanza = ws.stanza;
    if (stanza && rooms[stanza]) {
      // Rimuovo il socket dalla stanza
      rooms[stanza] = rooms[stanza].filter(peer => peer !== ws);

      // Notifico l'altro peer che ha lasciato la stanza
      rooms[stanza].forEach(peer => peer.send(JSON.stringify({ type: "peer-left" })));

      // Se la stanza è vuota, la elimino
      if (rooms[stanza].length === 0) delete rooms[stanza];
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () =>
  console.log(` Server attivo su http://localhost:${PORT}`)
);
