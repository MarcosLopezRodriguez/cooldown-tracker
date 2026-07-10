# Cooldown Tracker

Cooldown Tracker registra pausas entre visitas a sitios frecuentes. Puede usarse como aplicación web y como extensión de Chrome desde la misma base de código.

## Funciones

- Guarda sitios con una duración de cooldown independiente.
- Inicia el temporizador al abrir un sitio desde la aplicación o al marcar una visita.
- Filtra, busca y ordena los sitios por estado.
- Exporta e importa datos en JSON versionado.
- Muestra avisos y sonido mientras la aplicación está abierta.
- En la extensión de Chrome, bloquea la navegación de sitios en cooldown y avisa incluso si la página de la aplicación está cerrada.

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

La extensión solicita acceso a páginas `http` y `https` para poder detectar y redirigir una navegación cuando exista un cooldown activo. Los datos se almacenan localmente en Chrome mediante `chrome.storage`.

Al abrir un sitio desde la extensión, esa visita queda permitida y reinicia su cooldown. A partir de ahí:

- `Dominio completo` bloquea ese dominio y sus subdominios.
- `URL exacta` bloquea únicamente el enlace guardado.

La aplicación web y la extensión usan almacenes distintos por seguridad del navegador. Usa la exportación e importación JSON para mover tus datos entre ambas instalaciones.

## Datos y avisos

Los datos exportados contienen `version`, `items`, `settings` y `exportedAt`. La importación admite archivos de hasta 2 MB y rechaza formatos creados por una versión más reciente de la aplicación.

Los avisos de la extensión se programan con alarmas de Chrome. Para recibirlos, activa la opción de notificaciones desde la configuración de la aplicación y concede el permiso correspondiente.

## Comandos disponibles

```bash
npm run dev
npm run build
npm run build:extension
npm run preview
npm run lint
```

## Estructura

- [src/App.jsx](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/App.jsx): estado y flujos principales.
- [src/lib/sites.js](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/lib/sites.js): normalización, importación y reglas de cooldown.
- [src/lib/storage.js](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/lib/storage.js): persistencia web y persistencia de extensión.
- [extension/background.js](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/extension/background.js): alarmas, navegación y avisos de Chrome.
- [extension/blocked.html](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/extension/blocked.html): página que se muestra durante un bloqueo activo.
