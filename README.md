# Cooldown Tracker

Aplicacion React para gestionar *cooldowns* por sitio web y recibir avisos cuando se pueda volver a visitar.

## Requisitos
- Node.js 18+ y npm

## Uso rapido
```bash
npm install
npm run dev
```

Abre el enlace que imprime Vite (normalmente `http://localhost:5173`).

## Calidad
```bash
npm run lint
npm run test:run
```

## Build de produccion
```bash
npm run build
npm run preview
```

## Usarlo como extension en Chrome o Edge
```bash
npm install
npm run build
```

Despues:
1. Abre `chrome://extensions` o `edge://extensions`
2. Activa `Developer mode`
3. Pulsa `Load unpacked` / `Cargar descomprimida`
4. Selecciona la carpeta `dist`
5. Pulsa el icono de la extension

La extension abre la app en una pestana propia de extension para que los temporizadores no dependan de un popup efimero.

## Notas
- El estilo usa Tailwind integrado en el pipeline de Vite mediante PostCSS.
- `public/manifest.json` y `public/background.js` se copian a `dist` durante la build.
- Los datos exportados incluyen `version`, `items`, `settings` y `exportedAt`.
- Las notificaciones con la pestana totalmente cerrada requieren backend con Web Push. En esta version se muestran si la app esta abierta o cuando se reabre.
