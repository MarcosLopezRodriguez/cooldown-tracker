# Validación del proyecto

## Comprobaciones repetibles

Usa Node 24.15 o superior dentro de la rama 24 LTS y npm 12. El entorno de la comprobación del 19 de octubre de 2026 es Node 24.19.0 y npm 12.2.0.

```sh
npm ci
npm run check
npx --no-install playwright install chromium
npm run test:browser
```

En Linux, la instalación del navegador para CI usa `npx --no-install playwright install --with-deps chromium`.

`npm run check` valida el entorno, ejecuta ESLint sin advertencias y las regresiones deterministas, genera la web en `dist-web` y la extensión en `dist`, y valida sus recursos. `npm run test:browser` ejecuta escenarios persistentes con Playwright CLI en un perfil temporal aislado y un servidor local de datos de prueba. Cierra el navegador y el servidor al terminar, también cuando hay un fallo. No utiliza el perfil personal.

El workflow `.github/workflows/check.yml` ejecuta esos controles en push, pull request y ejecución manual. Sus acciones están fijadas a commits. Publica como artefactos de CI los directorios web, extensión e informes de validación. Su primera ejecución en GitHub requiere subir estos cambios; la validación local se documenta por separado.

## Evidencia que genera cada comprobación

- `npm test`: APIs de Chrome simuladas y reloj determinista para carreras, persistencia, importación, coincidencias, expiración y recuperación. Se incluyen las reproducciones de los errores detectados en la revisión inicial.
- `npm run test:browser`: navegador y extensión reales. Comprueba añadir, editar, iniciar/caducar, importar/recuperar, teclado, dos interfaces, cambios internos de URL, alarmas, parada del trabajador y reinicio de Chrome.
- `output/browser/results.json`: versión del navegador, perfil aislado, escenarios y comprobaciones superadas.
- `output/browser/step-*.log`: ejecución de cada escenario. En caso de fallo se guardan también `failure-snapshot.txt` y `failure-details.txt`.
- `artifacts/extension-1.0.0.json`: tamaño y SHA-256 de todos los archivos empaquetados, versión y huella conjunta. Se regenera con `npm run check:extension`.
- `store-assets/screenshots/`: PNG de 1280×800 con composiciones de dos vistas reales de la extensión y datos de demostración. El escenario de navegador regenera los originales en `output/browser`; tras revisarlos visualmente se copian a la carpeta de recursos de tienda.

El validador comprueba que manifiesto y package tienen la misma versión, que existen los recursos declarados y los módulos/entradas referenciados, que los iconos PNG tienen sus dimensiones y que están los ocho catálogos completos de Chrome.

## Criterios de comportamiento

- Las reglas de dominio cubren el host y sus subdominios en HTTP/HTTPS y en todos sus puertos. No coinciden con un dominio que solo comparte un sufijo de caracteres, como `notexample.com`.
- Una regla exacta compara la URL normalizada completa: protocolo, puerto, ruta, query y fragmento. El puerto predeterminado se normaliza; el orden de los parámetros de la query se conserva.
- Entre reglas activas tiene precedencia una URL exacta; después, el dominio más específico. El bloqueo rápido reconoce primero las reglas activas y reutiliza la regla existente que cubre la pestaña.
- No se añaden ni importan ámbitos duplicados silenciosamente. Los duplicados de datos heredados pueden eliminarse y no impiden aceptar la privacidad ni cambiar ajustes.
- `webNavigation.onBeforeNavigate`, `onHistoryStateUpdated` y `onReferenceFragmentUpdated` comparten el mismo comprobador. Se conservan las aperturas autorizadas y se agrupan redirecciones idénticas que todavía no han terminado. [Referencia oficial de navegación](https://developer.chrome.com/docs/extensions/reference/api/webNavigation).
- La pantalla bloqueada lee el estado actual, escucha sus cambios y comprueba todas las reglas coincidentes antes de ofrecer el regreso. Un cambio de duración, modo, idioma, eliminación o liberación se refleja sin recargar.
- La extensión modifica datos mediante un único coordinador. Cada operación se aplica sobre la lectura más reciente; un formulario antiguo solo cambia los campos editados y no recupera una regla eliminada.
- El trabajador finaliza y notifica cada par `id:endAt` con una identidad estable. Persiste las entregas pendientes y las reintenta sin crear identidades nuevas. Al iniciar o reanudar revisa los vencimientos pendientes y restaura alarmas. [Ciclo de vida oficial del trabajador](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
- La web conserva su reloj y sonido. En la extensión, el sonido de los avisos depende de Chrome y del sistema; el control de sonido personalizado explica esa disponibilidad y permanece deshabilitado.

## Lista de comprobación de entrega

1. Partir de una instalación limpia con `npm ci` y ejecutar `npm run check` y `npm run test:browser`.
2. Conservar el inventario SHA-256 junto al paquete que se vaya a entregar. Una modificación posterior de `dist` requiere repetir la validación y regenerar el inventario.
3. Revisar los PNG de tienda, su tamaño y la ausencia de datos personales. Las referencias SVG de `docs/screenshots` se mantienen como documentación.
4. Comprobar la [política de privacidad pública](https://raw.githubusercontent.com/MarcosLopezRodriguez/cooldown-tracker/refs/heads/web-extension-mode/PRIVACY.md). El 19 de octubre de 2026 respondió HTTP 200 y contenía la identificación y contacto del proyecto.
5. Cargar `dist` desde `chrome://extensions` en un perfil limpio si se hace una comprobación manual adicional. Verificar dominio/subdominio, URL exacta, History API, atrás/adelante, abrir una vez, dos ventanas, cambios de reglas con pantalla bloqueada, alarmas con popup cerrado y reinicio.
6. Revisar la configuración del sistema si se necesita comprobar visual o auditivamente la presentación de avisos. La prueba automatizada verifica su creación mediante la API de Chrome.

La suspensión automatizada consiste en detener el trabajador MV3 mediante CDP y esperar a que la alarma lo reactive. No suspende Windows. Los nombres, roles, estados accesibles y el foco se comprueban mediante el árbol de accesibilidad y teclado; no sustituyen una sesión con un lector de pantalla humano. Estas comprobaciones no publican la extensión en Chrome Web Store.
