import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';

const PORT = Number(process.env.PORT || 4001);
const BROWSER = process.env.BROWSER_EXECUTABLE || null;

const app = express();
app.use(express.json({limit: '10mb'}));

let serveUrl: string | null = null;
const bundling = bundle({
  entryPoint: path.join(__dirname, 'remotion', 'index.ts'),
  onProgress: (p) => {
    if (p % 20 === 0) console.log(`[bundle] ${p}%`);
  },
}).then((url) => {
  serveUrl = url;
  console.log(`[bundle] ready at ${url}`);
  return url;
});

app.get('/health', (_req, res) => {
  res.json({status: 'ok', bundled: serveUrl !== null});
});

app.post('/render', async (req, res) => {
  const body = req.body || {};
  const template = String(body.template || 'marigold').toLowerCase();
  const compositionId = template === 'midnight' ? 'Midnight' : 'Marigold';

  if (!body?.couple?.partnerOne || !body?.couple?.partnerTwo) {
    return res.status(400).json({error: 'couple.partnerOne and couple.partnerTwo are required'});
  }

  const inputProps = {
    couple: body.couple,
    eventDate: body.eventDate || '',
    venue: body.venue || {name: '', city: ''},
    message: body.message || '',
    photos: Array.isArray(body.photos) ? body.photos.slice(0, 6) : [],
    musicUrl: body.musicUrl || null,
    schedule: Array.isArray(body.schedule) ? body.schedule.slice(0, 6) : [],
    durationInSeconds: Math.min(60, Math.max(5, Number(body.durationInSeconds) || 30)),
  };

  const outPath = path.join(os.tmpdir(), `render-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);

  try {
    const url = await bundling;
    console.log(`[render] ${compositionId} for ${inputProps.couple.partnerOne} & ${inputProps.couple.partnerTwo}`);
    const composition = await selectComposition({serveUrl: url, id: compositionId, inputProps});

    await renderMedia({
      composition,
      serveUrl: url,
      codec: 'h264',
      outputLocation: outPath,
      inputProps,
      browserExecutable: BROWSER,
      x264Preset: 'veryfast',
      timeoutInMilliseconds: 120000,
      onProgress: ({progress}) => {
        const pct = Math.round(progress * 100);
        if (pct % 10 === 0) console.log(`[render] ${pct}%`);
      },
    });

    const stat = fs.statSync(outPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on('close', () => fs.unlink(outPath, () => {}));
  } catch (err: any) {
    console.error('[render] failed:', err);
    fs.unlink(outPath, () => {});
    if (!res.headersSent) {
      res.status(500).json({error: err?.message || 'render failed'});
    }
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`render-service listening on ${PORT}`));
