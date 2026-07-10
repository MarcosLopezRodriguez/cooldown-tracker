const parameters = new URLSearchParams(window.location.search);
const title = document.querySelector("#title");
const description = document.querySelector("#description");
const clock = document.querySelector("#clock");
const endAt = Number(parameters.get("endAt"));
const label = parameters.get("label") || "este sitio";

title.textContent = `${label} sigue en cooldown`;
description.textContent = "La extensión bloquea esta visita hasta que termine el temporizador.";

function updateClock() {
  const remaining = Math.max(0, endAt - Date.now());
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  clock.textContent = `${hours}:${minutes}:${seconds}`;

  if (remaining === 0) {
    description.textContent = "El cooldown ha terminado. Ya puedes volver a visitar el sitio.";
  }
}

updateClock();
window.setInterval(updateClock, 1000);

document.querySelector("#back-button").addEventListener("click", () => {
  window.history.back();
});
