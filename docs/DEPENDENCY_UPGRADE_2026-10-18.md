# Actualización de dependencias del 18 de octubre de 2026

Actualización aplicada y validada. Los cambios locales de marca que ya existían se han conservado. No se ha publicado una nueva versión en Chrome Web Store.

## Versiones

| Paquete | Antes | Ahora |
| --- | --- | --- |
| react / react-dom | 18.3.1 | 19.3.1 |
| vite | 6.4.3 | 8.3.4 |
| @vitejs/plugin-react | 4.7.0 | 6.1.2 |
| tailwindcss | 3.4.19 | 4.3.3 |
| @tailwindcss/vite | No utilizado | 4.3.3 |
| eslint | 9.39.4 | 10.13.0 |
| @eslint/js | 9.39.4 | 10.0.1 |
| eslint-plugin-react-hooks | 5.2.0 | 7.1.1 |
| eslint-plugin-react-refresh | 0.4.26 | 0.5.7 |
| globals | 15.15.0 | 17.13.0 |

Se han retirado Autoprefixer y los archivos `postcss.config.js` y `tailwind.config.js`: Tailwind 4 se integra directamente con Vite. También se ha retirado `eslint-plugin-react`; solo aportaba dos reglas de referencias JSX que ESLint 10 ya cubre de forma nativa. No se han forzado dependencias incompatibles.

Las versiones directas se han fijado para que la revisión sea reproducible. `npm outdated --json` devuelve `{}`. npm se ha actualizado de 12.0.2 a 12.2.0 y se ha alineado `packageManager`. Node se mantiene en 24.19.0, que cumple los requisitos de todas las dependencias; no se ha sustituido la instalación de Node del equipo.

## Adaptaciones

- Tailwind: importación e integración de la versión 4; fuentes limitadas a la aplicación e `index.html`; equivalencias de sombras, desenfoque y contornos para conservar el aspecto anterior.
- React y hooks: inicialización diferida del reloj, resolución de caducidades dentro de la suscripción al reloj, estado derivado del nombre automático y reinicio por clave de los campos de duración y favicon.
- Contexto de idiomas separado del componente proveedor para que Fast Refresh pueda funcionar sin advertencias.
- Análisis de código actualizado, sin desactivar las nuevas reglas de hooks; `lint` exige cero advertencias.
- Trece regresiones persistentes con el ejecutor de Node y una comprobación de integridad del paquete de extensión.

La espera de siete días configurada en npm impidió instalar inicialmente las publicaciones recientes de React y ESLint. Se comprobó su existencia en el registro y las notas oficiales y se usó una excepción de instalación solo para `react`, `react-dom` y `eslint`. No se cambió la política global. Una posterior instalación limpia con `npm ci`, sin excepciones, terminó correctamente.

## Comprobaciones completadas

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | Correcto, sin forzar pares ni usar legacy-peer-deps |
| `npm ls --depth=0` | Todas las dependencias directas resueltas |
| `npm outdated --json` | Sin actualizaciones directas pendientes |
| `npm run lint` | 0 errores y 0 advertencias |
| `npm test` | 13 pruebas correctas |
| `npm run build` | Compilación web correcta |
| `npm run build:extension` | Compilación de extensión correcta |
| `npm run check:extension` | 10 recursos, 3 entradas y 8 idiomas válidos |
| `npm audit --json` | 0 vulnerabilidades informadas; antes señalaba 14 paquetes |
| `git diff --check` | Sin errores de espacios |

Las regresiones automatizadas cubren URLs, duración mínima, ajustes antiguos, altas y ediciones, inicio/reinicio/liberación de cooldowns, bloqueo permanente, expiración sin repetición, búsqueda y filtros, copia y restauración, errores de JSON/versiones, formato antiguo, reloj y ocho idiomas.

### Navegador: web de producción

Pruebas con Playwright sobre la compilación de producción, en un perfil aislado:

- Añadir una regla, completar automáticamente el nombre y conservarla al recargar.
- Iniciar, reiniciar y liberar cooldowns; comprobar filtros y búsqueda.
- Editar nombre y duración, incluidos presets, «Próxima visita» y «Aplicar ahora».
- Descargar una copia real, rechazar JSON mal formado y restaurar el archivo descargado.
- Cambiar los ocho idiomas y verificar el idioma del documento.
- Eliminar con confirmación, recuperar desde copia y caducar con reloj acelerado: un único aviso y estado guardado con `endAt=null`.
- Foco inicial del formulario, cierre con Escape y retorno al activador.
- Vista de 420 px sin desbordamiento horizontal; comparación visual con la captura anterior de la vista de escritorio.

No se observaron excepciones de JavaScript de la aplicación. La petición del favicon externo de `example.com` devolvió 404 y se mostró el icono alternativo: no fue un fallo de React ni del empaquetado.

### Navegador: extensión instalada

Instalación real de `dist` en Chrome for Testing 155 mediante un perfil persistente aislado. Se han comprobado:

- Aceptación inicial, alta de regla y almacenamiento mediante las APIs reales de Chrome.
- Bloqueo permanente de navegación y pantalla de bloqueo.
- «Abrir una vez» y desbloqueo posterior.
- Regla de URL exacta: se bloquea el enlace guardado y se permite otra ruta del mismo dominio.
- Persistencia al recargar la interfaz.
- Activación de avisos y alarma real con la interfaz cerrada: se acortó el plazo de la regla de prueba a cinco segundos; Chrome finalizó el estado y registró una notificación. Al reabrir, el sitio figuraba disponible.

Las capturas y los fragmentos de comprobación están en `output/playwright/` y no se versionan. La pantalla de la extensión se abrió como página de extensión a 420 px; el clic en el botón de la barra y la ventana emergente nativa no se automatizaron.

## Límites y efectos

- La creación de la notificación está verificada mediante la API de Chrome; no se ha comprobado su percepción visual/sonora en el escritorio con una persona, la suspensión prolongada del equipo ni la instalación desde la tienda.
- No se han solucionado las tareas funcionales previas de la matriz de Eisenhower: esta actualización no las da por completadas.
- El JavaScript pasa de unos 77,95 kB a 100,13 kB comprimidos; el CSS, de 5,41 kB a 6,77 kB. El aumento acompaña al cambio de versiones. No se ha medido una mejora de rendimiento de ejecución.
- La copia previa del código y dependencias está en `C:\Users\Marcos\.codex\tmp\cooldown-dependencies-20261018`.

## Referencias de migración

- [ESLint 10: seguimiento nativo de referencias JSX](https://eslint.org/docs/latest/use/migrate-to-10.0.0#jsx-references-are-now-tracked).
- [Migración de Tailwind CSS 4](https://tailwindcss.com/docs/upgrade-guide).
- [Migración de Vite](https://vite.dev/guide/migration).
