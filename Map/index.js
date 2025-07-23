const express = require('express');
const path     = require('path');
const fs       = require('fs');
const csv      = require('csv-parser');
const fetch    = require('node-fetch');
const Bottleneck = require('bottleneck');      // throttle helper

const app  = express();
const PORT = process.env.PORT || 3000;
app.use(require('cors')());                    // allow front-end calls
app.use('/', express.static(path.join(__dirname, 'public')));

// ---- Nominatim throttle: 1 request / second ----
const limiter = new Bottleneck({ minTime: 1000 });

// cache file so you never geocode the same address twice
const cacheFile = './geocache.json';
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile)) : {};

// helper: geocode one address with retry + cache
async function geocode(addr) {
  if (cache[addr]) return cache[addr];                   // hit
  const url = `https://nominatim.openstreetmap.org/search?` +
              new URLSearchParams({ q: addr, format: 'json', limit: 1 });
  const res  = await limiter.schedule(() => fetch(url, {
                    headers: { 'User-Agent': 'newark-food-desert-map 1.0' }
                  }));
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!data.length) throw new Error(`No match for: ${addr}`);
  const { lat, lon } = data[0];
  cache[addr] = { lat: +lat, lon: +lon };               // save
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  return cache[addr];
}

// ---- API: /api/locations  ------------------------------------
app.get('/api/locations', async (_req, res) => {
  const rows = [];
  fs.createReadStream(path.join(__dirname, 'public', 'locations.csv'))
    .pipe(csv())
    .on('data', row => rows.push(row))
    .on('end', async () => {
      try {
        // enrich each row with lat & lon
        for (const r of rows) {
          const { lat, lon } = await geocode(r.address);
          r.latitude  = lat;
          r.longitude = lon;
        }
        res.json(rows);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
      }
    });
});

// ---- start server --------------------------------------------
app.listen(PORT, () =>
  console.log(`✓ http://localhost:${PORT}  (Ctrl-C to quit)`)
);
