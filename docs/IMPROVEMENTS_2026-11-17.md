# Mejoras adicionales · 17 de noviembre de 2026

- ESLint 10.15.0 actualiza la cadena de minimatch que generaba los tres avisos moderados. `npm audit` no notifica vulnerabilidades. Se aplicó una excepción puntual a la espera de siete días para instalar la corrección, sin cambiar la configuración global. [Notas oficiales](https://eslint.org/blog/2026/11/eslint-v10.15.0-released/).
- Los avisos web usan una identidad estable por sitio y vencimiento. Su historial local independiente de las exportaciones evita volver a avisar tras restaurar una copia o recargar. Si el almacenamiento falla, se mantiene la protección en memoria; borrar los datos del navegador borra el historial.
- «Aplicar ahora» calcula el vencimiento desde la última visita, sin reiniciar el tiempo transcurrido. «Próxima visita» conserva el vencimiento actual. Una regla eliminada o un contador finalizado mientras el diálogo está abierto no se recuperan al confirmar. La decisión solo se solicita para temporizadores activos que siguen siendo temporales.
- Nuevas pruebas de utilidades, favicons inválidos, almacenamiento sin `window`, avisos repetidos y decisiones de duración. Las entradas inválidas ya no generan solicitudes de favicon.
- Repasados los textos españoles y README: aclarada la decisión de duración y sustituido «soporta notificaciones» por «admite notificaciones». No se encontraron los ejemplos de tildes ausentes del listado antiguo en los textos revisados.

## Validación

También se actualizó la instalación global de Node en Windows mediante `winget`: 24.22.1 y npm 12.2.0, verificados con `npm run check:runtime`. El instalador oficial pasó la comprobación de hash del gestor de paquetes. La copia portátil queda disponible como alternativa.

Node 24.22.1 y npm 12.2.0: instalación desde lockfile, lint sin avisos, **57 pruebas correctas**, compilaciones web y extensión y validación de los 28 archivos/ocho idiomas. **50 comprobaciones en Chrome real**: 15 web, 3 mejoras web, 25 extensión, 4 reactivación del trabajador y 3 reinicio. La nueva prueba de navegador comprueba ambas decisiones de duración y que restaurar el mismo temporizador y recargar no duplique el aviso.

La suspensión comprobada sigue siendo la del trabajador MV3, no la de Windows. No se ha realizado una prueba humana con lector de pantalla ni publicado en Chrome Web Store.
