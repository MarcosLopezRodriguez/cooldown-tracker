# Mejoras importantes y no urgentes · 19 de octubre de 2026

Se han implementado las ocho tareas pendientes de este cuadrante para `cooldown-tracker`. La rama de trabajo sigue siendo `web-extension-mode`, principal del repositorio. La validación descrita se realizó sobre los cambios a partir del commit `1148b76`, antes del commit y push de esta entrega.

## Tareas y resultados

| Tarea de la matriz | Implementación y evidencia |
| --- | --- |
| [Serializar las actualizaciones de reglas y temporizadores](https://www.notion.so/3fdac8c259e7816dab63d81870fed71f) | `extension/coordinator.js` es el único escritor de la extensión. Los mensajes llevan operaciones y requestId; se aplican en cola al estado vigente. Las interfaces envían diferencias por campo y conservan las operaciones fallidas para reintentar. Dos alarmas concurrentes y expiración simultánea con edición/alta/baja están cubiertas de forma determinista. En Chrome real, dos interfaces editaron campos distintos de la misma regla y una edición obsoleta no recuperó una regla borrada. |
| [Unificar la finalización de cooldowns y sus avisos](https://www.notion.so/3fdac8c259e7816ba18bf830a11287b0) | El trabajador finaliza y notifica; el popup solo representa el estado. El registro persistente de pares `id:endAt` y las notificaciones con ID estable permiten reanudar y reintentar. En Chrome real se comprobaron dos alarmas, recarga, reapertura, apertura justo al vencer, parada del trabajador, reinicio y avisos desactivados. El sonido personalizado queda limitado a la web, como explica la interfaz. |
| [Actualizar la pantalla bloqueada cuando cambian las reglas](https://www.notion.so/3fdac8c259e7813f8ae5fc6beeeaca2e) | La URL identifica la regla y el destino; la pantalla resuelve el estado actual desde el almacén y escucha sus cambios. En Chrome real se comprobaron liberación desde el popup, borrado, duración menor/mayor, permanente/temporal y la existencia de otra regla activa antes de ofrecer el regreso. |
| [Cubrir los cambios de URL internos de las aplicaciones web](https://www.notion.so/3fdac8c259e781d38a6ff8728221b850) | Navegación normal, History API y fragmentos comparten el comprobador. En Chrome real se verificaron `pushState`, `replaceState`, query, hash, atrás/adelante, apertura autorizada y ausencia de redirecciones duplicadas en curso. |
| [Compartir las reglas de coincidencia entre popup y extensión](https://www.notion.so/3fdac8c259e7815a8bcacc1ed8b687cf) | La implementación canónica está en `extension/lib/rules.js`. Se documentan puertos, protocolos, subdominios, query/hash y precedencia. El bloqueo rápido real reutilizó una regla de `cooldown.test` desde `sub.cooldown.test`; no creó otra regla. Se rechazan duplicados al añadir, editar o importar, sin bloquear la limpieza de datos heredados. |
| [Hacer accesibles la importación, los interruptores y la duración](https://www.notion.so/3fdac8c259e78100a2eff2665c96a5ad) | Activador de archivo enfocable, switches con nombre/estado, duración etiquetada y sin remontar al escribir, resultados anunciados y foco de retorno explícito. Web y popup se verificaron con teclado, selector nativo, Tab, Shift+Tab, Escape, foco inicial y retorno; se comprobaron nombres, roles y estados en la accesibilidad de Chromium. |
| [Crear pruebas de regresión y automatizar las comprobaciones](https://www.notion.so/3fdac8c259e78143942ecc2aa0ddd8d4) | `npm run check` reúne entorno, lint, regresiones y los dos paquetes. `tests/browser` y `scripts/browser-smoke.mjs` conservan las pruebas reales mediante Playwright CLI. `.github/workflows/check.yml` configura los controles y artefactos para cada push/PR. `AGENTS.md` y `docs/VALIDATION.md` documentan el flujo. |
| [Preparar una validación repetible del paquete de publicación](https://www.notion.so/3fdac8c259e781d8b3ebc3c437bc2077) | Se comprueban versiones, módulos, HTML, iconos y ocho idiomas. El inventario SHA-256 identifica todos los archivos. Se registraron instalación limpia, reinicio, parada/reactivación del trabajador, bloqueos y avisos sin popup. Se verificó la política pública y se prepararon/revisaron dos PNG de tienda de 1280×800. Se actualizó el seguimiento local. |

## Validación final

- Instalación reproducible: `npm ci`, 156 paquetes auditados, 0 vulnerabilidades notificadas.
- `npm run check`: Node 24.19.0, npm 12.2.0, lint sin avisos, **51 pruebas correctas**, compilaciones web/extensión y validación del paquete correctas.
- `npm run test:browser`: **47 comprobaciones correctas** en Chrome for Testing 155.0.8059.12: 15 web, 25 extensión, 4 suspensión/reanudación y 3 reinicio.
- Paquete: `dist`, versión **1.0.0**, **28 archivos**, **8 idiomas**.
- Huella conjunta SHA-256: `83f0278de7f9e6b9b15db2af922c9e64f6e50c21cd4d48750e5051fbb1c5b42b`.
- Inventario: `artifacts/extension-1.0.0.json`. Resultados del navegador: `output/browser/results.json`, ejecución final del 19 de octubre a las 08:09:52 UTC.
- Capturas de tienda: `store-assets/screenshots/extension-overview.png` y `extension-settings.png`. Se revisaron visualmente. Son composiciones que muestran dos vistas de la interfaz real con datos de demostración, sin alterar sus controles.
- [Política de privacidad pública](https://raw.githubusercontent.com/MarcosLopezRodriguez/cooldown-tracker/refs/heads/web-extension-mode/PRIVACY.md): HTTP 200, identificación y contacto del proyecto presentes el 19 de octubre de 2026.

Las referencias de implementación de eventos y reactivación son la [documentación oficial de webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation) y el [ciclo de vida del trabajador MV3](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

## Límites de la evidencia

Las simulaciones deterministas y los recorridos en Chrome real se registran por separado. La suspensión comprobada es la del trabajador MV3 mediante CDP; no se suspendió Windows. Los avisos se verificaron mediante la API de Chrome; no se verificó visualmente el banner del sistema ni su sonido. La accesibilidad se comprobó con teclado y el árbol accesible, sin una sesión con lector de pantalla humano.

Los comandos del workflow pasaron localmente desde `npm ci`; en el momento de esta validación, el workflow todavía no se había ejecutado en GitHub con esta entrega. La política y las capturas están disponibles para preparar el envío; no se ha publicado en Chrome Web Store. La guía operativa es `docs/VALIDATION.md`.
