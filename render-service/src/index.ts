import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {DREAMWEDDS_COMPOSITION_BY_TEMPLATE} from './templates/dreamwedds/catalog';

const PORT = Number(process.env.PORT || 4001);
const BROWSER = process.env.BROWSER_EXECUTABLE || null;
// Remotion defaults concurrency to ~half the CPU cores. On a multi-core box
// with spare RAM (~1GB per Chrome worker) that leaves throughput on the table,
// so allow an explicit override via RENDER_CONCURRENCY (e.g. set to the core
// count). Unset => Remotion's auto default. x264 preset is also tunable:
// 'ultrafast' encodes fastest (slightly larger file), 'veryfast' is the prior
// default.
const RENDER_CONCURRENCY = process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : null;
const X264_PRESET = (process.env.RENDER_X264_PRESET || 'veryfast') as any;
const X264_PRESETS = new Set(['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow']);

const logEvent = (event: string, details: Record<string, unknown> = {}, error = false) => {
  const line = JSON.stringify({timestamp: new Date().toISOString(), service: 'render-service', event, ...details});
  if (error) console.error(line); else console.log(line);
};
const errorDetails = (err: unknown) => err instanceof Error
  ? {message: err.message, stack: err.stack} : {message: String(err)};

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

// Observe startup failures without replacing the rejected promise awaited by jobs.
void bundling.catch((err) => logEvent('bundle.failed', {error: errorDetails(err)}, true));

type JobStatus = 'queued' | 'rendering' | 'done' | 'failed';
type Job = {
  id: string;
  renderId?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  errorDetails?: {message: string; stack?: string; stage: string};
  outputPath?: string;
  createdAt: number;
  finishedAt?: number;
};
const jobs = new Map<string, Job>();

const buildInputProps = (body: any) => {
  const template = String(body.template || 'marigold').toLowerCase();
  const compMap: Record<string, string> = {
    ...DREAMWEDDS_COMPOSITION_BY_TEMPLATE,
    marigold: 'Marigold',
    midnight: 'Midnight',
    heartbeat: 'Heartbeat',
    story: 'Story',
    poster: 'Poster',
    showcase: 'Showcase',
    'engagement-glow': 'EngagementGlow',
    engagement: 'EngagementGlow',
    'royal-palace': 'RoyalPalace',
    'ring-reveal': 'RingReveal',
    'confetti-pop': 'ConfettiPop',
    'birthday-era-v1': 'BirthdayEra',
    'birthday-era': 'BirthdayEra',
    'golden-hour': 'GoldenHour',
    'from-my-heart-cinematic': 'FromMyHeart',
    'from-my-heart': 'FromMyHeart',
    'forever-special': 'ForeverSpecial',
    journey: 'Journey',
    cascade: 'Cascade',
  };
  const compositionId = compMap[template] || 'Marigold';
  const inputProps = {
    couple: body.couple || {partnerOne: 'Someone', partnerTwo: 'Special'},
    eventDate: body.eventDate || '',
    venue: body.venue || {name: '', city: ''},
    message: body.message || '',
    displayMessage: body.displayMessage || '',
    photos: Array.isArray(body.photos) ? body.photos.slice(0, Number(body.settings?.maxImages) || 6) : [],
    musicUrl: body.musicUrl || null,
    schedule: Array.isArray(body.schedule) ? body.schedule.slice(0, 6) : [],
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 12) : [],
    durationInSeconds: Math.min(60, Math.max(5, Number(body.durationInSeconds) || 30)),
    // Frame rate chosen by the backend (free videos render at a lower fps).
    // calculateMetadata clamps and recomputes durationInFrames from this.
    fps: Number(body.fps) > 0 ? Number(body.fps) : undefined,
    category: body.category || '',
    fields: body.fields || {},
    // DreamWedds compositions also have top-level defaults for Studio previews.
    // Pass the normalized nested payload explicitly so those defaults cannot
    // override the real partner wedding data at render time.
    dreamwedds: body.dreamwedds || body.fields?.dreamwedds,
    resolved: body.resolved || {},
    settings: body.settings || {},
    theme: body.theme || {version: 1, screens: {}},
    templateVersion: Number(body.templateVersion) || 1,
    qualityProfile: body.qualityProfile || {},
  };
  return {compositionId, inputProps};
};

// A render is valid if it carries a couple OR a data-driven fields bag.
const hasRenderableSubject = (body: any) =>
  (body?.couple?.partnerOne && body?.couple?.partnerTwo) ||
  (body?.fields && Object.keys(body.fields).length > 0);

const runRender = async (job: Job, body: any) => {
  const outPath = path.join(os.tmpdir(), `render-${job.id}.mp4`);
  job.outputPath = outPath;
  let stage = 'bundle';
  logEvent('render.started', {jobId: job.id, renderId: job.renderId});
  try {
    const url = await bundling;
    stage = 'input_props';
    const {compositionId, inputProps} = buildInputProps(body);
    const requestedPreset = String(inputProps.qualityProfile?.x264Preset || '');
    const renderPreset = (X264_PRESETS.has(requestedPreset) ? requestedPreset : X264_PRESET) as any;
    const requestedCrf = Number(inputProps.qualityProfile?.crf);
    const requestedJpegQuality = Number(inputProps.qualityProfile?.jpegQuality);
    console.log(`[job ${job.id}] ${compositionId} for ${inputProps.couple.partnerOne} & ${inputProps.couple.partnerTwo} (concurrency=${RENDER_CONCURRENCY ?? 'auto'}, preset=${renderPreset}, theme=v${inputProps.templateVersion})`);
    job.status = 'rendering';
    logEvent('render.input', {jobId: job.id, renderId: job.renderId, compositionId, inputProps});
    stage = 'select_composition';
    const composition = await selectComposition({serveUrl: url, id: compositionId, inputProps});
    stage = 'render_media';
    await renderMedia({
      composition,
      serveUrl: url,
      codec: 'h264',
      outputLocation: outPath,
      inputProps,
      browserExecutable: BROWSER,
      x264Preset: renderPreset,
      ...(Number.isFinite(requestedCrf) && requestedCrf >= 0 && requestedCrf <= 51 ? {crf: requestedCrf} : {}),
      ...(Number.isFinite(requestedJpegQuality) && requestedJpegQuality >= 0 && requestedJpegQuality <= 100 ? {jpegQuality: requestedJpegQuality} : {}),
      ...(RENDER_CONCURRENCY ? {concurrency: RENDER_CONCURRENCY} : {}),
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
    logEvent('render.completed', {jobId: job.id, renderId: job.renderId, elapsedMs: job.finishedAt - job.createdAt});
  } catch (err: any) {
    logEvent('render.failed', {jobId: job.id, renderId: job.renderId, stage, progress: job.progress, error: errorDetails(err)}, true);
    job.status = 'failed';
    job.error = err?.message || 'render failed';
    job.errorDetails = {...errorDetails(err), stage};
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
  const renderId = req.get('X-Render-Id');
  logEvent('render.received', {endpoint: req.path, renderId, payload: body});
  if (!hasRenderableSubject(body)) {
    logEvent('render.rejected', {endpoint: req.path, renderId, error: 'couple names or a fields payload are required'}, true);
    return res.status(400).json({error: 'couple names or a fields payload are required'});
  }
  const job: Job = {renderId, id: crypto.randomBytes(8).toString('hex'), status: 'queued', progress: 0, createdAt: Date.now()};
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
  const renderId = req.get('X-Render-Id');
  logEvent('render.received', {endpoint: req.path, renderId, payload: body});
  if (!hasRenderableSubject(body)) {
    logEvent('render.rejected', {endpoint: req.path, renderId, error: 'couple names or a fields payload are required'}, true);
    return res.status(400).json({error: 'couple names or a fields payload are required'});
  }
  const job: Job = {renderId, id: crypto.randomBytes(8).toString('hex'), status: 'queued', progress: 0, createdAt: Date.now()};
  jobs.set(job.id, job);
  // fire and forget
  runRender(job, body).catch((e) => logEvent('render.unexpected_error', {jobId: job.id, renderId, error: errorDetails(e)}, true));
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
    errorDetails: job.errorDetails || null,
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

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logEvent('request.failed', {endpoint: req.path, renderId: req.get('X-Render-Id'), error: errorDetails(err)}, true);
  res.status(err.status || 500).json({error: err.status === 400 ? 'Invalid JSON request' : 'Render service request failed'});
});

app.listen(PORT, '0.0.0.0', () => console.log(`render-service listening on ${PORT}`));
