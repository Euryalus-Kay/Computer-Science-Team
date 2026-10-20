export type ThemePref = "light" | "dark" | "system";
export const THEME_COOKIE = "lcs_theme";

/** Inline script run before paint so "system" users never see a flash. */
export const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )lcs_theme=([^;]+)/);var p=m?m[1]:'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export function applyTheme(pref: ThemePref) {
  document.cookie = `${THEME_COOKIE}=${pref};path=/;max-age=31536000;samesite=lax`;
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}
