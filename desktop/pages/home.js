const bridge = window.labcsDesktop;
const $ = (id) => document.getElementById(id);

async function render() {
  const info = await bridge.info();
  $("version").textContent = `Version ${info.version}`;
  if (info.server) {
    $("server").textContent = info.server.replace(/^https?:\/\//, "");
    $("site").hidden = false;
    $("setup").hidden = true;
  } else {
    $("site").hidden = true;
    $("setup").hidden = false;
  }
}

$("open").addEventListener("click", () => bridge.openSite());
$("setup").addEventListener("submit", async (e) => {
  e.preventDefault();
  let v = $("url").value.trim();
  if (v && !/^https?:\/\//.test(v)) v = `https://${v}`;
  const saved = await bridge.setServer(v);
  if (!saved) {
    $("url").classList.add("bad");
    return;
  }
  render();
});
render();
