/* Arranque: si el enlace trae ?sala=ABCD, abre directamente "Unirme" */
S.screen = codigoUrl() ? "onUnirme" : "home";
render();
