import http from 'node:http';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, join, relative } from 'node:path';
import { fixtureApi, playDueFixtures } from './src/fixtures.js';
import { openStore } from './src/local-store.js';
import { createRequire } from 'node:module';
import { Connection, Keypair } from '@solana/web3.js';
import { listingApi, openListingDesk } from './src/manager-listings.js';
import { loanApi, openLoanDesk } from './src/loan-desk.js';
import { buyerReviewApi } from './src/buyer-review.js';

const configuredEpoch = process.env.WORLD_START_UTC;
const configuredStart = configuredEpoch === undefined ? null : Date.parse(configuredEpoch);
if (configuredEpoch !== undefined && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(configuredEpoch) || !Number.isFinite(configuredStart))) {
  throw new Error('WORLD_START_UTC must be an ISO date and time in UTC, ending in Z.');
}
const dataDir = new URL('./data/', import.meta.url);
mkdirSync(dataDir, {recursive:true});
const fixtureFile = process.env.FIXTURE_DB || fileURLToPath(new URL('fixtures.sqlite', dataDir));
const db = openStore(fixtureFile);
const loanDesk = process.env.BALLERZ_LOAN_OPERATOR ? openLoanDesk(process.env.BALLERZ_LOAN_OPERATOR,fixtureFile) : null;
const sponsorFile = process.env.BALLERZ_LISTING_SPONSOR;
let listingDesk;
function getListingDesk() {
  if (!sponsorFile) return null;
  listingDesk ??= Promise.resolve().then(() => openListingDesk(
    new Connection(process.env.BALLERZ_DEVNET_RPC || 'https://api.devnet.solana.com','finalized'),
    Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(sponsorFile,'utf8')))),
    process.env.BALLERZ_LISTING_DB || fileURLToPath(new URL('listings.sqlite',dataDir)), undefined,
    Number(process.env.BALLERZ_LISTING_REQUEST_LIMIT ?? 12)
  )).catch(() => { listingDesk=undefined; return null; });
  return listingDesk;
}
const worldStart = db.worldStart(configuredStart);
const playtest = process.env.BALLERZ_PLAYTEST_CONTROLS === '1';
const publicDir = new URL('./public/', import.meta.url);
const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.png':'image/png', '.webp':'image/webp' };
const assets = new Map(readdirSync(publicDir, {recursive:true, withFileTypes:true}).filter(x => x.isFile()).map(entry => {
  const path = fileURLToPath(publicDir);
  const file = join(entry.parentPath, entry.name);
  const url = '/' + relative(path, file).replaceAll('\\', '/');
  return [url, {data:readFileSync(file), type:types[extname(entry.name)] || 'application/octet-stream'}];
}));

const web3 = createRequire(import.meta.url).resolve('@solana/web3.js');
assets.set('/vendor/wallet-standard.js',{data:readFileSync(new URL('wallets.js',import.meta.resolve('@wallet-standard/app'))),type:'application/javascript'});
assets.set('/vendor/solana.js',{data:readFileSync(join(web3,'..','index.iife.min.js')),type:'application/javascript'});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const parts = [];
      let size = 0;
      for await (const part of req) {
        size += part.length;
        if (size > 8192) { res.writeHead(413).end(); return; }
        parts.push(part);
      }
      const request = new Request(url, {method:req.method, headers:req.headers, body: parts.length ? Buffer.concat(parts) : undefined});
      const response = url.pathname.startsWith('/api/listings')
        ? await listingApi(request,await getListingDesk())
        : url.pathname.startsWith('/api/buyer-reviews') ? await buyerReviewApi(request,loanDesk)
        : url.pathname.startsWith('/api/loans/') ? await loanApi(request,loanDesk)
        : await fixtureApi(request, db, {worldStart, playtest});
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    const asset = assets.get(url.pathname === '/' ? '/index.html' : url.pathname);
    if (!asset || !['GET','HEAD'].includes(req.method)) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type':asset.type, 'Referrer-Policy':'no-referrer','Cache-Control':'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : asset.data);
  } catch (err) {
    console.error(err.message);
    if (!res.headersSent) res.writeHead(500, {'Content-Type':'application/json'});
    res.end(JSON.stringify({error:'The fixture service encountered an error.'}));
  }
});
const port = Number(process.env.PORT || 4173), host = process.env.HOST || '127.0.0.1';
{
  let running = false;
  async function runKickoffs() {
    if (running) return;
    running = true;
    try {
      await playDueFixtures(db);
    } catch (error) {
      console.error('Scheduled kickoff failed:', error.message);
    } finally {
      running = false;
    }
  }
  setInterval(runKickoffs, 1000).unref();
  await runKickoffs();
}
server.listen(port, host, () => console.log(`Ballerz Matchday http://${host}:${server.address().port}`));
