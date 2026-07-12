import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
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

type JobStatus = 'queued' | 'rendering' | 'done' | 'failed';
type Job = {
  id: string;
  status: JobStatus;
  progress: number;
  error?: string;
  outputPath?: string;
  createdAt: number;
  finishedAt?: number;
};
const jobs = new Map<string, Job>();

const buildInputProps = (body: any) => {
  const template = String(body.template || 'marigold').toLowerCase();
  const compMap: Record<string, string> = {
    marigold: 'Marigold',
    midnight: 'Midnight',
    heartbeat: 'Heartbeat',
    story: 'Story',
    poster: 'Poster',
    showcase: 'Showcase',
  };
  const compositionId = compMap[template] || 'Marigold';
  const inputProps = {
    couple: body.couple,
    eventDate: body.eventDate || '',
    venue: body.venue || {name: '', city: ''},
    message: body.message || '',
    displayMessage: body.displayMessage || '',
    photos: Array.isArray(body.photos) ? body.photos.slice(0, 6) : [],
    musicUrl: body.musicUrl || null,
    schedule: Array.isArray(body.schedule) ? body.schedule.slice(0, 6) : [],
    durationInSeconds: Math.min(60, Math.max(5, Number(body.durationInSeconds) || 30)),
  };
  return {compositionId, inputProps};
};

const runRender = async (job: Job, body: any) => {
  const outPath = path.join(os.tmpdir(), `render-${job.id}.mp4`);
  job.outputPath = outPath;
  try {
    const url = await bundling;
    const {compositionId, inputProps} = buildInputProps(body);
    console.log(`[job ${job.id}] ${compositionId} for ${inputProps.couple.partnerOne} & ${inputProps.couple.partnerTwo}`);
    job.status = 'rendering';
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
        job.progress = progress;
        const pct = Math.round(progress * 100);
        if (pct % 10 === 0) console.log(`[job ${job.id}] ${pct}%`);
      },
    });
    job.status = 'done';
    job.progress = 1;
    job.finishedAt = Date.now();
    console.log(`[job ${job.id}] done`);
  } catch (err: any) {
    console.error(`[job ${job.id}] failed:`, err);
    job.status = 'failed';
    job.error = err?.message || 'render failed';
    job.finishedAt = Date.now();
  }
};

// Sweep finished jobs older than 30 minutes.
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, j] of jobs) {
    if (j.finishedAt && j.finishedAt < cutoff) {
      if (j.outputPath) fs.unlink(j.outputPath, () => {});
      jobs.delete(id);
    }
  }
}, 5 * 60 * 1000);

app.get('/health', (_req, res) => {
  res.json({status: 'ok', bundled: serveUrl !== null, jobs: jobs.size});
});

// Legacy synchronous endpoint - kept for backwards compatibility.
app.post('/render', async (req, res) => {
  const body = req.body || {};
  if (!body?.couple?.partnerOne || !body?.couple?.partnerTwo) {
    return res.status(400).json({error: 'couple.partnerOne and couple.partnerTwo are required'});
  }
  const job: Job = {id: crypto.randomBytes(8).toString('hex'), status: 'queued', progress: 0, createdAt: Date.now()};
  jobs.set(job.id, job);
  await runRender(job, body);
  if (job.status === 'failed' || !job.outputPath) {
    return res.status(500).json({error: job.error || 'render failed'});
  }
  const stat = fs.statSync(job.outputPath);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  const stream = fs.createReadStream(job.outputPath);
  stream.pipe(res);
});

// Async: start job, return id immediately.
app.post('/render-async', (req, res) => {
  const body = req.body || {};
  if (!body?.couple?.partnerOne || !body?.couple?.partnerTwo) {
    return res.status(400).json({error: 'couple.partnerOne and couple.partnerTwo are required'});
  }
  const job: Job = {id: crypto.randomBytes(8).toString('hex'), status: 'queued', progress: 0, createdAt: Date.now()};
  jobs.set(job.id, job);
  // fire and forget
  runRender(job, body).catch((e) => console.error(`[job ${job.id}] unexpected:`, e));
  res.json({jobId: job.id, status: job.status});
});

app.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({error: 'job not found'});
  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error || null,
  });
});

app.get('/jobs/:id/video', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({error: 'job not found'});
  if (job.status !== 'done' || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return res.status(409).json({error: `job not ready (${job.status})`});
  }
  const stat = fs.statSync(job.outputPath);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  fs.createReadStream(job.outputPath).pipe(res);
});

app.listen(PORT, '0.0.0.0', () => console.log(`render-service listening on ${PORT}`));
