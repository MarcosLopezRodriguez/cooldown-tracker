# Guía de trabajo

Responde en español de España. Conserva los cambios locales y la identidad del reloj de arena.

## Código compartido

`extension/lib/` contiene las funciones puras que comparten web, popup y trabajador. `src/lib/sites.js`, `constants.js` y `utils.js` reexportan esas funciones para conservar los imports existentes. No dupliques las reglas de coincidencia.

En la extensión, el único escritor de sitios y ajustes es `extension/coordinator.js`: usa mensajes `state-mutate` con operaciones e identificadores de petición, nunca snapshots completos desde una interfaz. Las escrituras se ordenan y se aplican sobre el último estado disponible. Las importaciones son operaciones explícitas de reemplazo; no transfieren la aceptación de privacidad.

El trabajador finaliza los temporizadores y emite las notificaciones de la extensión. El popup solo representa el resultado. La web mantiene su propio reloj y sonido. Conserva la información de vencimiento hasta que el coordinador la procese.

## Validación

- `npm run check` comprueba Node/npm, lint, regresiones deterministas, compilación web (`dist-web`), compilación de extensión (`dist`) y recursos/versiones del paquete. Requiere Node 24.15+ dentro de 24 LTS y npm 12.
- `npx --no-install playwright install chromium` instala el navegador de las pruebas. En CI Linux se usa `--with-deps`.
- `npm run test:browser` usa Playwright CLI, un servidor local y un perfil temporal aislado. Comprueba web y extensión real, teclado, varias interfaces, navegación interna, alarmas, parada del trabajador y reinicio de Chrome. No usa el perfil personal ni publica nada.
- `artifacts/extension-1.0.0.json` identifica cada archivo del paquete y su huella conjunta SHA-256. Regenera el inventario con `npm run check:extension` tras cambiar el build.
- Las pruebas de APIs simuladas y las pruebas en Chrome real son evidencias distintas. No afirmes una publicación, una auditoría con lector de pantalla humano o una suspensión del sistema operativo basándote solo en ellas.

La automatización de `.github/workflows/check.yml` ejecuta estos controles en push y pull request. No se publica automáticamente en Chrome Web Store. Consulta `docs/VALIDATION.md` antes de preparar una entrega.
