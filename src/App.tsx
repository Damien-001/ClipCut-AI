import React, { useState, useRef } from "react";
import { Upload, Scissors, Download, FileVideo, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface UploadedFile {
  filename: string;
  originalName: string;
  size: number;
}

interface ProcessResult {
  jobId: string;
  clips: string[];
  count: number;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [segmentDuration, setSegmentDuration] = useState(30);
  const [uploadedRef, setUploadedRef] = useState<UploadedFile | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 500 * 1024 * 1024) {
        setError("Le fichier dépasse 500 Mo.");
        return;
      }
      setFile(selected);
      setError(null);
      setResult(null);
      setUploadedRef(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("video", file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status === 200) {
            setUploadedRef(data);
          } else {
            setError(data.error || "Échec du téléchargement.");
          }
        } catch (e) {
          setError("Réponse serveur invalide.");
        }
        setIsUploading(false);
      };

      xhr.onerror = () => {
        setError("Erreur réseau branchée.");
        setIsUploading(false);
      };

      xhr.send(formData);
    } catch (err) {
      setError("Une erreur est survenue.");
      setIsUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!uploadedRef) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/cut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: uploadedRef.filename,
          segmentDuration: segmentDuration
        })
      });

      const data = await response.json();
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || "Erreur de traitement.");
      }
    } catch (err) {
      setError("Une erreur est survenue pendant le découpage.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    // Clean up server files
    if (result || uploadedRef) {
      try {
        await fetch("/api/cleanup", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: result?.jobId,
            filename: uploadedRef?.filename
          })
        });
      } catch (_) {
        // ignore cleanup errors
      }
    }
    setFile(null);
    setUploadedRef(null);
    setResult(null);
    setUploadProgress(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div id="app-root" className="min-h-screen bg-neutral-50 font-sans text-neutral-900 px-4 py-12 md:py-24">
      <div className="max-w-2xl mx-auto">
        <header className="mb-12 text-center" id="main-header">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-neutral-900 text-white rounded-2xl mb-6 shadow-xl"
            id="logo-container"
          >
            <Scissors className="w-8 h-8" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl md:text-5xl font-light tracking-tight mb-3"
            id="app-title"
          >
            ClipCut AI
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-neutral-500 text-lg font-light leading-relaxed"
            id="app-subtitle"
          >
            Divisez vos vidéos en segments parfaits pour vos réseaux sociaux en un clic.
          </motion.p>
        </header>

        <div className="space-y-8" id="main-content">
          {/* Step 1: Upload */}
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-200" id="upload-section">
            <h2 className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-6 flex items-center">
              <span className="w-6 h-px bg-neutral-200 mr-3"></span>
              1. Charger la Vidéo
            </h2>

            {!file ? (
              <div 
                id="dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) {
                    if (dropped.size > 500 * 1024 * 1024) return setError("500MB max");
                    setFile(dropped);
                  }
                }}
                className="border-2 border-dashed border-neutral-100 rounded-2xl p-12 text-center hover:border-neutral-900 transition-colors cursor-pointer group bg-neutral-50"
              >
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  accept="video/mp4,video/x-m4v,video/*"
                  onChange={handleFileChange}
                />
                <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-200 group-hover:text-neutral-900 transition-colors" />
                <p className="text-neutral-600 font-medium">Glissez une vidéo ici</p>
                <p className="text-neutral-400 text-sm mt-1 uppercase tracking-tight font-medium">MP4, MOV ou AVI (Max 500 Mo)</p>
              </div>
            ) : (
              <motion.div 
                id="file-preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-neutral-50 rounded-2xl flex items-center justify-between border border-neutral-200"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center text-white">
                    <FileVideo className="w-6 h-6" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-medium text-neutral-900 truncate max-w-[200px] md:max-w-md">{file.name}</p>
                    <p className="text-xs text-neutral-400 font-mono">{formatSize(file.size)}</p>
                  </div>
                </div>
                {!uploadedRef && !isUploading && (
                  <button 
                    id="btn-change-file"
                    onClick={() => { setFile(null); setUploadedRef(null); setResult(null); }}
                    className="text-xs font-semibold text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-wider"
                  >
                    Changer
                  </button>
                )}
              </motion.div>
            )}

            {file && !uploadedRef && !isUploading && (
              <button
                id="btn-upload"
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full mt-6 py-4 bg-neutral-900 text-white rounded-2xl font-medium hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
              >
                Valider le fichier
              </button>
            )}

            {isUploading && (
              <div className="mt-6 space-y-3" id="upload-progress-container">
                <div className="flex justify-between text-xs font-medium uppercase tracking-wider">
                  <span className="text-neutral-500 flex items-center gap-2 italic">
                    <Loader2 className="w-3 h-3 animate-spin" /> Téléchargement...
                  </span>
                  <span className="text-neutral-900">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="h-full bg-neutral-900"
                  />
                </div>
              </div>
            )}

            {uploadedRef && (
              <motion.div 
                id="upload-success"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex items-center gap-2 text-neutral-600 text-sm font-medium bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Fichier prêt pour le découpage
              </motion.div>
            )}
          </section>

          {/* Step 2: Settings */}
          <AnimatePresence>
            {uploadedRef && !result && (
              <motion.section 
                id="settings-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-200 overflow-hidden"
              >
                <h2 className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-6 flex items-center">
                  <span className="w-6 h-px bg-neutral-200 mr-3"></span>
                  2. Configuration
                </h2>

                <div className="space-y-6">
                  <div id="duration-input-container">
                    <label className="block mb-2 text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                      Durée de chaque clip (secondes)
                    </label>
                    <input 
                      type="number"
                      min="5"
                      id="input-duration"
                      disabled={isProcessing}
                      value={segmentDuration}
                      onChange={(e) => setSegmentDuration(parseInt(e.target.value) || 5)}
                      className="block w-full px-5 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none font-mono text-xl"
                    />
                    <p className="mt-2 text-xs text-neutral-400 italic">Valeur recommandée : 30 secondes pour les Shorts/Reels.</p>
                  </div>
                  
                  <button
                    id="btn-process"
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className="w-full py-5 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 active:scale-[0.98] uppercase tracking-widest text-sm"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Traitement...
                      </>
                    ) : (
                      <>
                        <Scissors className="w-5 h-5" />
                        Lancer le découpage
                      </>
                    )}
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div 
                id="error-alert"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.section 
                id="results-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-200"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <h2 className="text-xs uppercase tracking-widest text-neutral-400 font-semibold flex items-center">
                    <span className="w-6 h-px bg-neutral-200 mr-3"></span>
                    Clips Générés ({result.count})
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      id="btn-new-video"
                      onClick={handleReset}
                      className="flex items-center justify-center gap-2 text-sm font-bold border-2 border-neutral-900 text-neutral-900 px-5 py-3 rounded-2xl hover:bg-neutral-900 hover:text-white transition-all active:scale-95"
                    >
                      <Upload className="w-4 h-4" />
                      Nouvelle vidéo
                    </button>
                    <a 
                      id="btn-download-all"
                      href={`/api/download-all/${result.jobId}`}
                      className="flex items-center justify-center gap-2 text-sm font-bold bg-neutral-900 text-white px-6 py-3 rounded-2xl hover:bg-black transition-colors shadow-lg active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Tout télécharger (ZIP)
                    </a>
                  </div>
                </div>

                <div className="grid gap-3" id="clips-list">
                  {result.clips.map((clip, idx) => (
                    <motion.div 
                      key={clip}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 rounded-2xl border border-neutral-50 bg-neutral-50 flex items-center justify-between group hover:border-neutral-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-neutral-100 flex items-center justify-center text-neutral-400 group-hover:bg-neutral-900 group-hover:text-white group-hover:border-neutral-900 transition-all">
                          <Scissors className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-neutral-700 font-mono tracking-tight">{clip}</span>
                      </div>
                      <a 
                        id={`btn-download-${idx}`}
                        href={`/api/download/${result.jobId}/${clip}`}
                        className="p-3 hover:bg-white rounded-xl text-neutral-400 hover:text-neutral-900 transition-all shadow-sm border border-transparent hover:border-neutral-100"
                        title="Télécharger"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        <footer className="mt-20 text-center border-t border-neutral-100 pt-10" id="main-footer">
          <p className="text-[10px] text-neutral-300 uppercase tracking-[0.3em] font-bold">ClipCut AI — Powered by FFmpeg Fast Mode</p>
        </footer>
      </div>
    </div>
  );
}

