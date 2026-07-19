const parameters = new URLSearchParams(window.location.search);
const eyebrow = document.querySelector("#eyebrow");
const title = document.querySelector("#title");
const description = document.querySelector("#description");
const clock = document.querySelector("#clock");
const endAt = Number(parameters.get("endAt"));
const label = parameters.get("label") || "este sitio";
const target = parameters.get("target");
const permanent = parameters.get("mode") === "always" || !Number.isFinite(endAt) || endAt <= 0;
const backButton = document.querySelector("#back-button");
let cooldownFinished = false;

if (permanent) {
  eyebrow.textContent = "Bloqueo permanente";
  title.textContent = `${label} está bloqueado`;
  description.textContent = "Este sitio está configurado como bloqueo permanente en Cooldown Tracker.";
  clock.textContent = "Bloqueado";
  clock.classList.add("clock-label");
} else {
  title.textContent = `${label} sigue en cooldown`;
  description.textContent = "La extensión bloquea esta visita hasta que termine el temporizador.";
}

function updateClock() {
  if (permanent) {
    return;
  }

  const remaining = Math.max(0, endAt - Date.now());
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  clock.textContent = `${hours}:${minutes}:${seconds}`;

  if (remaining === 0) {
    cooldownFinished = true;
    description.textContent = "El cooldown ha terminado. Ya puedes volver a visitar el sitio.";
    backButton.textContent = "Volver al sitio";
  }
}

updateClock();
if (!permanent) {
  window.setInterval(updateClock, 1000);
}

backButton.addEventListener("click", () => {
  if (cooldownFinished && target) {
    window.location.replace(target);
    return;
  }

  window.history.back();
});
