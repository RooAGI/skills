import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiHandler } from "./api.mjs";
const here = path.dirname(fileURLToPath(import.meta.url)), dist = path.resolve(here, "../dist");
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".svg":"image/svg+xml", ".ico":"image/x-icon" };
const api = createApiHandler();
createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    await api(req, res, () => { res.statusCode = 404; res.end("Not found"); }); return;
  }
  let file = path.resolve(dist, "." + decodeURIComponent(url.pathname));
  if (!file.startsWith(dist + path.sep) && file !== dist) { res.statusCode = 400; res.end("Bad path"); return; }
  if (file === dist || !file.startsWith(dist + path.sep)) file = path.join(dist, "index.html");
  try { await access(file); } catch { file = path.join(dist, "index.html"); }
  res.setHeader("content-type", mime[path.extname(file)] ?? "application/octet-stream");
  createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? "127.0.0.1", () => {
  console.log("Skills Atlas listening on " + (process.env.HOST ?? "127.0.0.1") + ":" + (process.env.PORT ?? 4173));
});
