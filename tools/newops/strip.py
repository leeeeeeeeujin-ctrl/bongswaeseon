import asyncio, threading, http.server, socketserver, sys, json, functools
from playwright.async_api import async_playwright
ROOT = "/tmp/claude-0/-home-claude/0f5894f6-5a4f-5270-947a-362dcd546bdc/scratchpad/newops/art"
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
srv = socketserver.TCPServer(("127.0.0.1", 0), H); PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
id, rig, clips, glob, rows, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], json.loads(sys.argv[5]), sys.argv[6]
sc = float(sys.argv[7]) if len(sys.argv) > 7 else 0.42; cw = int(sys.argv[8]) if len(sys.argv) > 8 else 300; ch = int(sys.argv[9]) if len(sys.argv) > 9 else 330
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1600, "height": 1200})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/strip.html")
        import os
        if os.environ.get("OVER"): await pg.evaluate("o => { window.OVER = o; }", json.loads(os.environ["OVER"]))
        print(await pg.evaluate("([a,b,c,d,e,f,g,h]) => run(a,b,c,d,e,f,g,h)", [id, rig, clips, glob, rows, sc, cw, ch]), errs[:3])
        await (await pg.query_selector("#c")).screenshot(path=out)
        await b.close()
asyncio.run(main())
