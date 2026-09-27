// Browser preview: proxies the Expo web dev server, adds the cross-origin isolation headers
// expo-sqlite needs on every response, and serves an iPhone 13 mini frame at "/phone".
//   npx expo start --web --port 8082   then   node scripts/web-preview.mjs   ->  http://localhost:8083/phone
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAPLIBRE_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/maplibre-gl/dist");

const TARGET = { host: "127.0.0.1", port: Number(process.env.EXPO_PORT ?? 8082) };
const PORT = Number(process.env.PORT ?? 8083);
const ISOLATION = {
  "cross-origin-embedder-policy": "credentialless",
  "cross-origin-opener-policy": "same-origin",
};

const FRAME = `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><title>Moje Mapy – iPhone 13 mini</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#15181d;font-family:-apple-system,Segoe UI,sans-serif;color:#8a94a3}
  .wrap{height:100%;display:flex;align-items:center;justify-content:center}
  .phone{position:relative;width:375px;height:812px;border-radius:52px;padding:12px;background:#000;
    box-shadow:0 0 0 2px #3a3f47,0 30px 80px rgba(0,0,0,.6);transform-origin:center;box-sizing:content-box}
  .screen{position:relative;width:375px;height:812px;border-radius:42px;overflow:hidden;background:#0B0E13}
  /* iPhone 13 mini safe area: 50 pt status bar, 34 pt home indicator */
  iframe{border:0;position:absolute;top:50px;left:0;width:375px;height:728px;display:block}
  .status{position:absolute;top:0;left:0;right:0;height:50px;display:flex;align-items:center;justify-content:space-between;
    padding:6px 30px 0 34px;box-sizing:border-box;color:#fff;font-size:15px;font-weight:600}
  .status i{font-style:normal;font-size:12px;letter-spacing:1px}
  .notch{position:absolute;top:0;left:50%;transform:translateX(-50%);width:170px;height:32px;background:#000;
    border-radius:0 0 20px 20px;z-index:2;pointer-events:none}
  .home{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:120px;height:5px;border-radius:3px;
    background:rgba(255,255,255,.55);z-index:2;pointer-events:none}
  .hint{position:fixed;left:12px;bottom:10px;right:12px;font-size:11px;text-align:center;line-height:1.4}
</style></head>
<body><div class="wrap">
  <div class="phone" id="phone"><div class="screen">
    <div class="status"><span id="clock">9:41</span><i>▂▄▆ ᯤ ▮▮▮▯</i></div>
    <div class="notch"></div><iframe src="/" allow="geolocation"></iframe><div class="home"></div>
  </div></div>
  <div class="hint">iPhone 13 mini (375×812) · dlouhý stisk = podržet myš / pravé tlačítko · GPS, hlas a offline mapy fungují plně jen v telefonu</div>
</div>
<script>
  const fit = () => { const s = Math.min(1, (innerHeight - 56) / 836, (innerWidth - 24) / 399); document.getElementById('phone').style.transform = 'scale(' + s + ')'; };
  addEventListener('resize', fit); fit();
  const tick = () => { const d = new Date(); document.getElementById('clock').textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  setInterval(tick, 10000); tick();
</script></body></html>`;

http
  .createServer((req, res) => {
    if (req.url === "/phone") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...ISOLATION });
      res.end(FRAME);
      return;
    }
    // maplibre-gl v6 loads its worker as a separate ES module, which Metro cannot bundle.
    const lib = req.url?.match(/^\/maplibre\/([\w.-]+\.mjs)(\?.*)?$/);
    if (lib) {
      fs.readFile(path.join(MAPLIBRE_DIST, lib[1]), (err, buf) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", ...ISOLATION });
        res.end(buf);
      });
      return;
    }
    const upstream = http.request({ ...TARGET, method: req.method, path: req.url, headers: { ...req.headers, host: `${TARGET.host}:${TARGET.port}` } }, (up) => {
      res.writeHead(up.statusCode ?? 502, { ...up.headers, ...ISOLATION });
      up.pipe(res);
    });
    upstream.on("error", (err) => {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`Expo dev server not reachable on ${TARGET.port}: ${err.message}`);
    });
    req.pipe(upstream);
  })
  .on("upgrade", (req, socket, head) => {
    const up = net.connect(TARGET.port, TARGET.host, () => {
      up.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
      for (let i = 0; i < req.rawHeaders.length; i += 2) up.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
      up.write("\r\n");
      up.write(head);
      up.pipe(socket).pipe(up);
    });
    up.on("error", () => socket.destroy());
    socket.on("error", () => up.destroy());
  })
  .listen(PORT, () => console.log(`Moje Mapy preview: http://localhost:${PORT}`));
