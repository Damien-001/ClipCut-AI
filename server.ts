import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs-extra";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import archiver from "archiver";
import { fileURLToPath } from 'url';
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set FFmpeg and FFprobe paths from static packages
  if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
  ffmpeg.setFfprobePath(ffprobeStatic.path);

  // Ensure directories exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const outputsDir = path.join(process.cwd(), 'outputs');
  await fs.ensureDir(uploadsDir);
  await fs.ensureDir(outputsDir);

  // Configure Multer for video uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });

  const upload = multer({ 
    storage, 
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['.mp4', '.mov', '.avi'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Format non supporté. Utilisez MP4, MOV ou AVI.'));
      }
    }
  });

  app.use(express.json());

  // API Route: Check FFmpeg
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: Video Upload
  app.post("/api/upload", (req, res) => {
    upload.single("video")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: "Fichier trop volumineux (max 500 Mo)" });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      
      if (!req.file) return res.status(400).json({ error: "Aucun fichier téléchargé" });
      
      res.json({ 
        filename: req.file.filename, 
        originalName: req.file.originalname,
        size: req.file.size
      });
    });
  });

  // API Route: Cut Video
  app.post("/api/cut", async (req, res) => {
    const { filename, segmentDuration } = req.body;
    
    if (!filename || !segmentDuration) {
      return res.status(400).json({ error: "Paramètres manquants" });
    }

    const inputPath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: "Vidéo source introuvable" });
    }

    const jobId = Date.now().toString();
    const jobDir = path.join(outputsDir, jobId);
    await fs.ensureDir(jobDir);

    ffmpeg.ffprobe(inputPath, async (err, metadata) => {
      if (err) {
        console.error("FFprobe error:", err);
        return res.status(500).json({ error: "Impossible d'analyser la vidéo" });
      }
      
      const duration = metadata.format.duration;
      if (!duration) {
        return res.status(500).json({ error: "Impossible de déterminer la durée de la vidéo" });
      }

      const durSec = parseFloat(segmentDuration);
      if (isNaN(durSec) || durSec < 5) {
        return res.status(400).json({ error: "La durée minimale est de 5 secondes" });
      }

      const numSegments = Math.ceil(duration / durSec);
      const clips: string[] = [];
      const tasks: Promise<void>[] = [];

      for (let i = 0; i < numSegments; i++) {
        const startTime = i * durSec;
        const segmentName = `clip_${String(i + 1).padStart(3, '0')}.mp4`;
        const outputPath = path.join(jobDir, segmentName);

        tasks.push(new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(durSec)
            .outputOptions("-c copy") // Fast mode
            .output(outputPath)
            .on("end", () => {
              clips.push(segmentName);
              resolve();
            })
            .on("error", (err) => {
              console.error(`Clip ${i} error:`, err);
              reject(err);
            })
            .run();
        }));
      }

      try {
        await Promise.all(tasks);
        res.json({ jobId, clips: clips.sort(), count: clips.length });
      } catch (error) {
        res.status(500).json({ error: "Erreur lors du découpage des clips" });
      }
    });
  });

  // API Route: Download individual file
  app.get("/api/download/:jobId/:clipName", (req, res) => {
    const { jobId, clipName } = req.params;
    const filePath = path.join(outputsDir, jobId, clipName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Fichier introuvable");
    }
    
    res.download(filePath, clipName);
  });

  // API Route: Delete job files and uploaded video
  app.delete("/api/cleanup", async (req, res) => {
    const { jobId, filename } = req.body;
    try {
      if (jobId) {
        const jobDir = path.join(outputsDir, jobId);
        if (fs.existsSync(jobDir)) await fs.remove(jobDir);
      }
      if (filename) {
        const uploadedFile = path.join(uploadsDir, filename);
        if (fs.existsSync(uploadedFile)) await fs.remove(uploadedFile);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de la suppression" });
    }
  });

  // API Route: Download all files as ZIP
  app.get("/api/download-all/:jobId", async (req, res) => {
    const { jobId } = req.params;
    const jobDir = path.join(outputsDir, jobId);
    
    if (!fs.existsSync(jobDir)) {
      return res.status(404).send("Session introuvable");
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment(`clips_${jobId}.zip`);

    archive.on('error', (err) => {
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);
    archive.directory(jobDir, false);
    await archive.finalize();
  });

  // Serve static files and handle Vite
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
