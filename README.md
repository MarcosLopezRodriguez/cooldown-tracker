# Cooldown Tracker Web

Aplicación web para registrar pausas entre visitas a sitios frecuentes y saber cuándo vuelve a estar disponible cada uno.

## Funciones

- Guarda sitios con una duración de cooldown independiente.
- Inicia el temporizador al abrir un sitio desde la aplicación o al marcar una visita.
- Filtra, busca y ordena los sitios por estado.
- Sincroniza cambios entre pestañas abiertas de la aplicación.
- Exporta e importa datos en JSON versionado.
- Muestra notificaciones y sonido mientras la aplicación está abierta.

## Desarrollo

```bash
npm install
npm run dev
```

Vite mostrará una URL local, normalmente `http://localhost:5173`.

## Producción

```bash
npm run build
npm run preview
```

La salida se genera en `dist` y puede desplegarse en cualquier alojamiento de archivos estáticos.

## Datos y avisos

Los datos se guardan en el almacenamiento local del navegador. Puedes exportarlos antes de cambiar de equipo o navegador e importarlos después desde la configuración.

La duración máxima de un cooldown es de 30 días. Las notificaciones requieren permiso del navegador y, sin Web Push o un backend, no se mantienen cuando todas las pestañas de la aplicación están cerradas.

## Comandos

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Estructura

- [src/App.jsx](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/App.jsx): estado y flujos principales.
- [src/lib/sites.js](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/lib/sites.js): normalización, importación y reglas de cooldown.
- [src/lib/storage.js](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/lib/storage.js): persistencia y sincronización entre pestañas.
- [src/components](C:/Users/Marcos/Documents/Proyectos/cooldown-tracker/src/components): interfaz de sitios, configuración y diálogos.
