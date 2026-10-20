const bridge = window.labcsDesktop;
const $ = (id) => document.getElementById(id);
$("cancel").addEventListener("click", () => bridge.exitCancel());
$("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("err").hidden = true;
  const ok = await bridge.exitCode($("code").value);
  if (!ok) {
    $("err").hidden = false;
    $("code").select();
  }
});
document.addEventListener("keydown", (e) => e.key === "Escape" && bridge.exitCancel());
