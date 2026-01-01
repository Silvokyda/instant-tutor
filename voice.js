let conversation = [];
let sessionActive = false;
let state = "idle"; // "idle" | "listening" | "thinking" | "speaking"

const orb = document.getElementById("voice-orb");
const stateLabel = document.getElementById("voice-state");

const supportsSR =
  "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
const supportsTTS = "speechSynthesis" in window;

let recognizer = null;
let isListening = false;

function setState(newState, label) {
  state = newState;
  orb.classList.remove("idle", "listening", "thinking", "speaking");
  orb.classList.add(newState);
  if (label) stateLabel.textContent = label;
}

function initRecognizer() {
  if (!supportsSR) return null;
  if (recognizer) return recognizer;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    isListening = true;
    if (sessionActive) {
      setState("listening", "Listening… tap to stop");
    }
  };

  rec.onend = () => {
    isListening = false;
    // If the session is still active and we're not in thinking/speaking,
    // go back to idle/listening loop.
    if (sessionActive && state === "listening") {
      // User stayed silent; restart listening gently
      setTimeout(() => {
        if (sessionActive && !isListening) startListening();
      }, 200);
    } else if (!sessionActive && state !== "idle") {
      setState("idle", "Tap the orb to start the tutor");
    }
  };

  rec.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    if (sessionActive) {
      setState("idle", "Voice error – tap to restart");
      sessionActive = false;
    }
  };

  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (!transcript) {
      if (sessionActive) {
        setState("listening", "Didn't catch that. Listening…");
        startListening();
      }
      return;
    }

    conversation.push({ role: "user", content: transcript });
    askTutor();
  };

  recognizer = rec;
  return rec;
}

function startListening() {
  if (!sessionActive) return;
  const rec = initRecognizer();
  if (!rec) {
    stopSession("Voice not supported in this browser.");
    return;
  }

  if (isListening) return;

  try {
    rec.start();
  } catch (e) {
    console.warn("Error starting recognition:", e);
    stopSession("Mic error – tap to restart");
  }
}

function speak(text) {
  if (!supportsTTS || !text) {
    if (sessionActive) {
      // If we can't speak, just continue listening loop
      setState("listening", "Listening… tap to stop");
      startListening();
    } else {
      setState("idle", "Tap the orb to start the tutor");
    }
    return;
  }

  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1.0;
    u.pitch = 1.0;

    u.onstart = () => {
      if (!sessionActive) return;
      setState("speaking", "Speaking… tap to stop");
    };

    u.onend = () => {
      if (!sessionActive) {
        setState("idle", "Tap the orb to start the tutor");
        return;
      }
      // After speaking, go back to listening automatically
      setState("listening", "Listening… tap to stop");
      startListening();
    };

    u.onerror = () => {
      if (sessionActive) {
        setState("listening", "Listening… tap to stop");
        startListening();
      } else {
        setState("idle", "Tap the orb to start the tutor");
      }
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn("speechSynthesis error:", e);
    if (sessionActive) {
      setState("listening", "Listening… tap to stop");
      startListening();
    } else {
      setState("idle", "Tap the orb to start the tutor");
    }
  }
}

async function askTutor() {
  if (!sessionActive) return;
  setState("thinking", "Thinking…");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversation,
        plan: null, // generic tutor in voice mode
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed: ${res.status}`);
    }

    const data = await res.json();
    const reply =
      data.reply ||
      "I couldn't come up with a response. Please try asking again.";

    conversation.push({ role: "assistant", content: reply });
    speak(reply);
  } catch (err) {
    console.error(err);
    stopSession("Error talking to tutor – tap to start again");
  }
}

function startSession() {
  if (!supportsSR) {
    alert("Voice mode is not supported in this browser. Try Chrome or Edge.");
    return;
  }

  sessionActive = true;
  conversation = [];

  if (supportsTTS) {
    window.speechSynthesis.cancel();
  }

  setState("listening", "Listening… tap to stop");
  startListening();
}

function stopSession(label) {
  sessionActive = false;

  if (recognizer && isListening) {
    try {
      recognizer.stop();
    } catch (_) {}
  }
  if (supportsTTS) {
    window.speechSynthesis.cancel();
  }

  setState("idle", label || "Tap the orb to start the tutor");
}

function handleOrbTap() {
  if (!sessionActive) {
    startSession();
  } else {
    stopSession("Voice session stopped. Tap to start again");
  }
}

/* Initial setup */
if (!supportsSR && !supportsTTS) {
  setState("idle", "Voice not supported in this browser.");
} else if (!supportsSR) {
  setState("idle", "No mic support. Try a different browser.");
} else {
  setState("idle", "Tap the orb to start the tutor");
}

orb.addEventListener("click", handleOrbTap);