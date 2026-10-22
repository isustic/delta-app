// Rulează înainte de prima randare ca să nu existe clipire la pornire.
// Inline-ul ar fi blocat de CSP-ul Tauri (script-src 'self'), de aceea e fișier separat.
(function () {
  try {
    var pref = localStorage.getItem("delta.theme");
    var dark =
      pref === "dark" ||
      ((!pref || pref === "system") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
