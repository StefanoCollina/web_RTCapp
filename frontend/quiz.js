// quiz.js
import { sendQuizToPeer, sendQuizAnswerToPeer, quizChannel } from "./connessione.js";

const questionsArea = document.getElementById("questions-area");
const addQuestionBtn = document.getElementById("add-question-btn");
const sendQuizBtn = document.getElementById("send-quiz-btn");
const previewList = document.getElementById("preview-list");

// Contenitore quiz ricevuto
const receivedContainer = document.getElementById("quiz-received");
const receivedText = document.getElementById("quiz-text");
const answerButtonsContainer = document.getElementById("quiz-answer-buttons"); // contenitore dinamico

// Contenitore risultato risposta
const resultContainer = document.getElementById("quiz-result");
const resultText = document.getElementById("quiz-result-text");

let questionCount = 1;
let quizData = [];
let currentQuestionIndex = 0;
let userAnswers = [];

// creazione domande
function updatePreview() {
    const blocks = document.querySelectorAll(".question-block"); // seleziona tutte le comande
    previewList.innerHTML = "";

    blocks.forEach((block, i) => { // per ogni domanda
        const text = block.querySelector(".question-text").value.trim() || "(domanda vuota)"; // aggiunge la domanda. se è vuota aggiunte (domanda vuota)
        const li = document.createElement("li"); // creazione elemento lista
        li.textContent = `${i + 1}) ${text}`;
        li.style.marginBottom = "8px";
        previewList.appendChild(li);
    });
}

function attachInputListener(block) { // collegato il testo delle domande direttamente alla preview
    const input = block.querySelector(".question-text");
    input.addEventListener("input", () => {
        updatePreview();
    });
}

// Inizializza la prima domanda
const firstBlock = document.querySelector(".question-block");
if (firstBlock) attachInputListener(firstBlock);
updatePreview();

// aggiungi domanda
addQuestionBtn.addEventListener("click", () => {
    questionCount++;

    const newBlock = document.createElement("div");
    newBlock.classList.add("question-block");

    newBlock.innerHTML = `
        <h4 class="question-title">Domanda ${questionCount}</h4>
        <input type="text" class="question-text" placeholder="Scrivi la domanda..." style="width:100%;">
        <div class="question-answer">
          <label><input type="radio" name="answer-${questionCount}" value="true"> Vero</label>
          <label><input type="radio" name="answer-${questionCount}" value="false"> Falso</label>
        </div>
        <hr>
    `;

    questionsArea.appendChild(newBlock);
    attachInputListener(newBlock);
    updatePreview();
});

// ivio quiz
sendQuizBtn.addEventListener("click", () => {
    const blocks = document.querySelectorAll(".question-block");
    const quiz = [];

    blocks.forEach((block, i) => {
        const questionText = block.querySelector(".question-text").value.trim();
        const answer = block.querySelector("input[type='radio']:checked");

        quiz.push({
            id: i + 1,
            question: questionText,
            correct: answer ? answer.value === "true" : null // correct sarà true se  è  vera, false se è falsa o null se non è stata selezionata la risposta
        });
    });

    sendQuizToPeer(quiz);
    alert("Quiz inviato!");

    // svuota quiz
    questionsArea.innerHTML = `
        <div class="question-block">
          <h4 class="question-title">Domanda 1</h4>
          <input type="text" class="question-text" placeholder="Scrivi la domanda..." style="width:100%;">
          <div class="question-answer">
            <label><input type="radio" name="answer-1" value="true"> Vero</label>
            <label><input type="radio" name="answer-1" value="false"> Falso</label>
          </div>
          <hr>
        </div>
    `;
    
    questionCount = 1;  // reset contatore domande
    updatePreview();    // aggiorna il riepilogo
});


// mostra domande
function showQuestion(index) {
    if (index >= quizData.length) {
        // Quiz completato, invio resoconto
        sendQuizAnswerToPeer({ results: userAnswers });
        alert("Risposte inviate!");
        receivedContainer.style.display = "none";
        return;
    }

    const question = quizData[index];
    receivedText.textContent = index + ")" + question.question;
    receivedText.style = "background-color:white; border-radius: 15px; border-color: 2px solid #a3a3a3";
    receivedContainer.dataset.correct = question.correct;

    // Genera i pulsanti Vero/Falso dinamicamente
    answerButtonsContainer.innerHTML = "";
    ["true", "false"].forEach(value => {
        const btn = document.createElement("button");
        btn.textContent = value === "true" ? "Vero" : "Falso";
        btn.dataset.answer = value;
        btn.classList.add("answer-btn");
        btn.addEventListener("click", () => {
            const answer = btn.dataset.answer === "true"; // converte la risposta in booleano
            const correct = receivedContainer.dataset.correct === "true"; // converte la risposta corretta in booleano

            // Salvo la risposta
            userAnswers.push({ question: question.question, answer, correct });

            // Passo alla prossima domanda
            currentQuestionIndex++;
            showQuestion(currentQuestionIndex);
        });
        answerButtonsContainer.appendChild(btn);
    });

    receivedContainer.style.display = "block";
}

// ricezione
window.addEventListener("quiz_received", (event) => { // ascolto dell'evento creato in connessione
    quizData = event.detail;
    currentQuestionIndex = 0; // 0 perchè è la prima domanda del quiz
    userAnswers = [];
    showQuestion(currentQuestionIndex);
});

// ricezione risposta
window.addEventListener("quiz_answer", (event) => {
    const answer = event.detail;

    if (answer.results) { // se sono più risposte
        resultText.innerHTML = answer.results.map((r, i) => {
            return `${i + 1}) "${r.question}" - risposta: ${r.answer === r.correct ? "✔ Corretto" : "❌ Sbagliato"}`;
        }).join("<br>");
    } else {
        resultText.textContent = answer.answer === answer.correct
            ? "✔ Il peer ha risposto correttamente!"
            : "❌ Il peer ha sbagliato.";
    }

    resultContainer.style.display = "block";
});
