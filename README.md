# Cooldown Tracker

Aplicacion React para gestionar *cooldowns* por sitio web y recibir avisos cuando se pueda volver a visitar.

## Requisitos
- Node.js 18+ y npm

## Uso rapido
```bash
npm install
npm run dev
```
Abre el enlace que imprime Vite (normalmente http://localhost:5173).

### Checks
```bash
npm run lint
npm run test:run
```

### Build de produccion
```bash
npm run build
npm run preview
```

## Notas
- El estilo usa Tailwind via CDN en `index.html` para simplificar.
- Las notificaciones con la pestana completamente cerrada requieren backend con Web Push. En esta version se muestran si la app esta abierta (o al volver a abrir).
