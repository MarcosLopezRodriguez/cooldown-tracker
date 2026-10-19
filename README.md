# Cooldown Tracker

Cooldown Tracker registra pausas entre visitas a sitios frecuentes. Puede usarse como aplicación web y como extensión de Chrome desde la misma base de código.

## Funciones

- Guarda sitios con bloqueo permanente o con una duración de cooldown independiente.
- Inicia el temporizador al abrir un sitio desde la aplicación o al marcar una visita.
- Filtra, busca y ordena los sitios por estado.
- Exporta e importa datos en JSON versionado.
- En la versión web, muestra avisos y sonido mientras la aplicación está abierta.
- En la extensión de Chrome, bloquea la navegación de sitios en cooldown o con bloqueo permanente y avisa incluso si la página de la aplicación está cerrada.
- Incluye español, inglés, francés, alemán, italiano, polaco, chino y ruso. El modo `Automático` sigue el idioma de Chrome y también puede cambiarse manualmente desde la configuración.

## Aplicación web

```bash
npm install
npm run dev
```

Para generar la versión web de producción:

```bash
npm run build
npm run preview
```

La versión web puede registrar y mostrar cooldowns, pero no puede impedir que navegues a otros sitios desde el navegador. Esa función pertenece a la extensión.

## Extensión de Chrome

Genera el paquete:

```bash
npm run build:extension
```

Después, en Chrome abre `chrome://extensions`, activa el modo de desarrollador y selecciona **Cargar descomprimida**. Elige la carpeta `dist` generada por el build.

No cargues la carpeta `public` ni la raíz del proyecto como extensión: esas carpetas no contienen la aplicación empaquetada. Si Chrome muestra `ERR_FILE_NOT_FOUND` al pulsar el icono de la barra, elimina esa carga anterior y vuelve a cargar `dist`.

La extensión solicita acceso a páginas `http` y `https` para poder detectar y redirigir una navegación cuando exista un cooldown activo o un bloqueo permanente. Los datos se almacenan localmente en Chrome mediante `chrome.storage`.

El nombre, la descripción y el título del botón de la extensión usan los catálogos nativos de Chrome en `extension/_locales`. La interfaz, las notificaciones y la pantalla de bloqueo respetan la misma preferencia de idioma guardada por el usuario.

Al abrir un sitio desde la extensión, esa visita queda permitida y reinicia su cooldown. A partir de ahí:

- `Dominio completo` bloquea ese dominio y sus subdominios.
- `URL exacta` bloquea únicamente el enlace guardado.

Desde el popup puedes bloquear directamente la pestaña activa. Al añadir un sitio puedes elegir entre `Bloqueo permanente` y `Cooldown temporal`; el modo permanente queda activo hasta que lo desactives manualmente.

El bloqueo rápido reconoce las reglas de un dominio padre desde sus subdominios. Las URLs exactas incluyen query y fragmento y se comprueban también al cambiar una ruta mediante History API. La pantalla bloqueada refleja cambios de reglas y duraciones sin recarga manual. La precedencia y los casos cubiertos están documentados en [la guía de validación](docs/VALIDATION.md).

La aplicación web y la extensión usan almacenes distintos por seguridad del navegador. Usa la exportación e importación JSON para mover tus datos entre ambas instalaciones.

La primera vez que se abre la extensión se muestra una explicación del tratamiento local de URLs. El bloqueo permanece inactivo hasta que el usuario acepta expresamente este uso.

## Publicación en Chrome Web Store

Los textos preparados para la ficha, el propósito único, las justificaciones de permisos y la lista de recursos están en [docs/CHROME_WEB_STORE.md](docs/CHROME_WEB_STORE.md).

La política que debe alojarse en una URL pública antes de enviar la extensión está en [PRIVACY.md](PRIVACY.md).

El icono de tienda está en `extension/icons/icon128.png`. Después de ejecutar `npm run build:extension`, comprime el contenido de `dist` de forma que `manifest.json` quede en la raíz del ZIP.

## Datos y avisos

Los datos exportados contienen `version`, `items`, `settings` y `exportedAt`. La importación admite archivos de hasta 2 MB y rechaza formatos creados por una versión más reciente de la aplicación.

Exporta una copia antes de sustituir datos. La importación valida todo el archivo, rechaza filas y ámbitos duplicados y muestra una vista previa antes de confirmar. Puedes cancelar sin cambios. La aceptación de privacidad pertenece a cada instalación y no se transfiere en una copia. Ante un fallo de almacenamiento se puede exportar lo que aparece en pantalla y reintentar; una lectura fallida protege los originales.

Los avisos de la extensión se programan con alarmas de Chrome. Para recibirlos, activa la opción de notificaciones desde la configuración de la aplicación y concede el permiso correspondiente.

El trabajador coordina las escrituras de las distintas interfaces y es responsable de finalizar los temporizadores y crear sus avisos, también tras reiniciarse. El sonido personalizado corresponde a la versión web; en la extensión, Chrome y el sistema controlan el sonido de las notificaciones.

## Comandos disponibles

```bash
npm run dev
npm run build
npm run build:extension
npm run preview
npm run lint
npm test
npm run check:extension
npm run check
npm run test:browser
```

`npm test` ejecuta las regresiones de reglas, temporizadores, importación/exportación e idiomas.
Después de `npm run build:extension`, `npm run check:extension` comprueba el manifiesto, las entradas empaquetadas, los iconos y los ocho catálogos de Chrome.

`npm run check` reúne la validación del entorno, análisis, pruebas y ambas compilaciones. `npm run test:browser` usa Playwright CLI y una extensión real en un perfil temporal. La instalación del navegador, CI, evidencias y comprobación del paquete se explican en [docs/VALIDATION.md](docs/VALIDATION.md). Las convenciones de mantenimiento están en [AGENTS.md](AGENTS.md).

El proyecto usa React 19, Vite 8 y Tailwind CSS 4 mediante `@tailwindcss/vite`; no requiere Autoprefixer ni configuración PostCSS adicional. ESLint 10 reconoce JSX de forma nativa. Las versiones directas están fijadas y `package-lock.json` permite reinstalar con `npm ci`.

La instalación de esta actualización usó una excepción puntual a la espera de siete días de npm para `react`, `react-dom` y `eslint`, después de comprobar sus publicaciones oficiales. La política de espera global no se ha desactivado.

Tras cambios de dependencias, ejecuta análisis, pruebas y ambas compilaciones. Comprueba además en Chrome instalado el bloqueo por dominio y URL exacta, la apertura puntual, las alarmas con la interfaz cerrada y la restauración de una copia. El informe de la actualización está en [docs/DEPENDENCY_UPGRADE_2026-10-18.md](docs/DEPENDENCY_UPGRADE_2026-10-18.md).

## Estructura

- [src/App.jsx](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/App.jsx): estado y flujos principales.
- [src/lib/sites.js](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/lib/sites.js): normalización, importación y reglas de cooldown.
- [src/lib/storage.js](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/lib/storage.js): persistencia web y persistencia de extensión.
- [extension/background.js](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/extension/background.js): alarmas, navegación y avisos de Chrome.
- [extension/blocked.html](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/extension/blocked.html): página que se muestra durante un bloqueo activo.
