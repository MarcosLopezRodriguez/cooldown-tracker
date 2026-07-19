# Ficha de Chrome Web Store

## Nombre

Cooldown Tracker

## Resumen

Bloquea sitios por tiempo o de forma permanente y recupera el control de tus visitas desde el navegador.

## Descripción detallada

Cooldown Tracker te ayuda a espaciar visitas repetitivas y bloquear distracciones sin perder tu lista de sitios.

Configura cada web con un bloqueo permanente o un cooldown temporal. La extensión detecta las coincidencias por dominio completo o URL exacta, muestra cuánto falta para volver y puede avisarte cuando termina la espera.

Funciones principales:

- Bloqueo permanente hasta que decidas desactivarlo.
- Cooldowns independientes para cada sitio.
- Reglas por dominio completo o URL exacta.
- Bloqueo rápido de la pestaña activa.
- Avisos cuando una web vuelve a estar disponible.
- Importación y exportación local de la configuración.
- Datos guardados únicamente en tu navegador.

Cooldown Tracker no envía tu historial ni tus reglas a servidores externos y no utiliza analítica ni publicidad.

La extensión incluye interfaz localizada en español, inglés, francés, alemán, italiano, polaco, chino y ruso. Chrome selecciona automáticamente el idioma compatible más cercano y el usuario puede sustituirlo desde la configuración.

## Propósito único

Ayudar al usuario a controlar la frecuencia con la que visita sitios web mediante bloqueos locales permanentes o temporales definidos por el propio usuario.

## Justificación de permisos

### storage

Guarda localmente la lista de sitios, el modo de bloqueo, los temporizadores y las preferencias del usuario. Los datos no se sincronizan con servidores propios.

### alarms

Programa el final de los cooldowns para actualizar su estado aunque el popup de la extensión esté cerrado.

### favicon

Obtiene mediante la API local de Chrome el icono asociado a cada sitio guardado para identificarlo visualmente en el popup. No descarga ni transmite el icono a servidores propios.

### notifications

Muestra un aviso local cuando termina un cooldown, únicamente si el usuario activa las notificaciones.

### webNavigation

Detecta las navegaciones principales para comparar la URL con las reglas definidas por el usuario y mostrar la pantalla de bloqueo cuando exista una coincidencia activa.

### Acceso a sitios HTTP y HTTPS

Es necesario para comparar dominios y URLs visitadas con la lista local de bloqueos. La extensión no lee el contenido de las páginas ni transmite la actividad de navegación.

## Declaraciones de privacidad

- Código remoto: **No**.
- Analítica: **No**.
- Publicidad: **No**.
- Venta o transferencia de datos: **No**.
- Datos tratados: actividad web limitada a URLs y dominios, y contenido proporcionado por el usuario en su lista.
- Tratamiento: exclusivamente local para prestar la función de bloqueo.

## Recursos gráficos

- Icono de tienda: `extension/icons/icon128.png`.
- Capturas: entre 1 y 5 imágenes de `1280x800` o `640x400`.
- Tile promocional pequeño: `440x280` en PNG o JPEG.
- Imagen marquee opcional: `1400x560` en PNG o JPEG.

Antes de publicar, sustituye el marcador de correo de `PRIVACY.md` y aloja esa política en una URL pública y estable.
