import { useState, useRef } from 'react'
import Head from 'next/head'

interface ClipResult {
  id: string
  title: string
  hookTitle: string
  startTime: number
  endTime: number
  duration: number
  reason: string
  engagementScore: number
  thumbnail?: string
  downloadUrl?: string
  previewReady: boolean
  subtitles?: SubtitleEntry[]
}

interface SubtitleEntry {
  start: number
  end: number
  text: string
}

type Step = 'input' | 'analyzing' | 'results' | 'processing'

export default function Home() {
  const [url, setUrl] = useState('')
  const [step, setStep] = useState<Step>('input')
  const [clips, setClips] = useState<ClipResult[]>([])
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [analysisLog, setAnalysisLog] = useState<string[]>([])
  const [videoInfo, setVideoInfo] = useState<{ title: string; thumbnail: string; duration: number } | null>(null)
  const [activePreview, setActivePreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addLog = (msg: string) => setAnalysisLog(prev => [...prev, msg])

  const handleAnalyze = async () => {
    if (!url.trim()) return
    setError('')
    setAnalysisLog([])
    setStep('analyzing')

    try {
      addLog('🔍 Mengambil informasi video...')
      await sleep(600)
      addLog('📊 Mendeteksi segmen paling sering di-replay...')
      await sleep(800)
      addLog('🤖 AI menganalisis konteks & narasi...')
      await sleep(700)
      addLog('✂️ Menemukan momen terbaik untuk di-clip...')
      await sleep(600)
      addLog('📝 Membuat judul hook yang menarik...')

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analisis gagal')

      setVideoInfo(data.videoInfo)
      setClips(data.clips)
      addLog('✅ Selesai! Menemukan ' + data.clips.length + ' clip terbaik.')
      await sleep(400)
      setStep('results')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Terjadi kesalahan'
      setError(msg)
      setStep('input')
    }
  }

  const handleProcessClip = async (clip: ClipResult) => {
    setProcessingId(clip.id)
    setStep('processing')
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, clip }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Proses gagal')

      setClips(prev => prev.map(c =>
        c.id === clip.id
          ? { ...c, downloadUrl: data.downloadUrl, previewReady: true }
          : c
      ))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Proses gagal'
      setError(msg)
    } finally {
      setProcessingId(null)
      setStep('results')
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
    } catch {
      inputRef.current?.focus()
    }
  }

  return (
    <>
      <Head>
        <title>ClipShort — YouTube to Shorts AI Clipper</title>
        <meta name="description" content="AI-powered YouTube clipper. Deteksi momen viral, buat subtitle otomatis, judul hook yang menarik." />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✂️</text></svg>" />
      </Head>

      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <header style={{
          padding: '1.25rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          background: 'rgba(10,10,15,0.9)',
          backdropFilter: 'blur(12px)',
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36,
              background: 'var(--accent)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>✂</div>
            <span className="font-display" style={{ fontSize: 22, letterSpacing: '0.08em' }}>CLIPSHORT</span>
            <span style={{
              fontSize: 11,
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              padding: '2px 8px',
              borderRadius: 20,
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}>AI</span>
          </div>
          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <a href="https://github.com" target="_blank" style={{
              color: 'var(--text-muted)',
              fontSize: 13,
              fontFamily: 'Space Grotesk, sans-serif',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              transition: 'color 0.2s',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
              </svg>
              GitHub
            </a>
          </nav>
        </header>

        {/* Main Content */}
        <main style={{ flex: 1, padding: '0 1.5rem' }}>

          {/* Hero */}
          {step === 'input' && (
            <section style={{ maxWidth: 720, margin: '0 auto', padding: '5rem 0 3rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <p style={{
                  fontSize: 12,
                  letterSpacing: '0.2em',
                  color: 'var(--accent)',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  textTransform: 'uppercase',
                }}>AI-POWERED YOUTUBE CLIPPER</p>
                <h1 className="font-display" style={{
                  fontSize: 'clamp(52px, 8vw, 88px)',
                  lineHeight: 0.95,
                  marginBottom: '1.25rem',
                  background: 'linear-gradient(135deg, #f0ede8 0%, rgba(240,237,232,0.5) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  CLIP VIRAL.<br />
                  <span style={{
                    background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>BUAT SHORTS.</span>
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 17, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                  AI mendeteksi momen yang paling sering di-replay, lalu otomatis membuat clip dengan subtitle & judul hook yang menarik.
                </p>
              </div>

              {/* Features strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginBottom: '2.5rem',
              }}>
                {[
                  { icon: '🔥', label: 'Most-Replayed Detection', desc: 'Deteksi momen viral otomatis' },
                  { icon: '🎬', label: 'Auto Subtitle', desc: 'Subtitle cetak terbakar di video' },
                  { icon: '🪝', label: 'Hook Title AI', desc: 'Judul yang bikin penonton kepo' },
                ].map((f) => (
                  <div key={f.label} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '1rem',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'Space Grotesk,sans-serif', marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.desc}</div>
                  </div>
                ))}
              </div>

              {/* URL Input */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem',
              }}>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  letterSpacing: '0.12em',
                  color: 'var(--text-muted)',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '0.75rem',
                }}>URL Video YouTube</label>

                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <input
                    ref={inputRef}
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                    placeholder="https://www.youtube.com/watch?v=..."
                    style={{
                      flex: 1,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.8rem 1rem',
                      color: 'var(--text)',
                      fontSize: 15,
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  />
                  <button
                    onClick={handlePaste}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.8rem 1rem',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                  >📋 Paste</button>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!url.trim()}
                  style={{
                    width: '100%',
                    background: url.trim() ? 'var(--accent)' : 'var(--bg-elevated)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    color: url.trim() ? 'white' : 'var(--text-muted)',
                    fontSize: 15,
                    fontWeight: 600,
                    fontFamily: 'Space Grotesk, sans-serif',
                    cursor: url.trim() ? 'pointer' : 'not-allowed',
                    letterSpacing: '0.04em',
                    transition: 'all 0.2s',
                  }}
                >
                  ✂️ Analisis & Buat Clip
                </button>

                {error && (
                  <div style={{
                    marginTop: 12,
                    background: 'rgba(255,50,50,0.08)',
                    border: '1px solid rgba(255,50,50,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem 1rem',
                    color: '#ff6b6b',
                    fontSize: 13,
                  }}>{error}</div>
                )}
              </div>

              {/* Example URLs */}
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Coba dengan:</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Podcast', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
                    { label: 'Tutorial', url: 'https://www.youtube.com/watch?v=aircAruvnKk' },
                    { label: 'Interview', url: 'https://www.youtube.com/watch?v=ZQElzjCsl9o' },
                  ].map(ex => (
                    <button
                      key={ex.label}
                      onClick={() => setUrl(ex.url)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 20,
                        padding: '4px 14px',
                        color: 'var(--text-muted)',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'Space Grotesk, sans-serif',
                        transition: 'all 0.2s',
                      }}
                    >{ex.label}</button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Analyzing Step */}
          {step === 'analyzing' && (
            <section style={{ maxWidth: 600, margin: '0 auto', padding: '6rem 0', textAlign: 'center' }}>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{
                  width: 72, height: 72,
                  borderRadius: '50%',
                  border: '3px solid var(--border)',
                  borderTopColor: 'var(--accent)',
                  margin: '0 auto 1.5rem',
                  animation: 'spin 0.9s linear infinite',
                }} />
                <h2 className="font-display" style={{ fontSize: 36, marginBottom: '0.5rem' }}>MENGANALISIS VIDEO</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>AI sedang memindai momen terbaik...</p>
              </div>

              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                textAlign: 'left',
                maxHeight: 240,
                overflowY: 'auto',
              }}>
                {analysisLog.map((log, i) => (
                  <div key={i} style={{
                    fontSize: 13,
                    color: i === analysisLog.length - 1 ? 'var(--text)' : 'var(--text-muted)',
                    padding: '4px 0',
                    fontFamily: 'Space Grotesk, sans-serif',
                    animation: 'fadeIn 0.3s ease',
                  }}>{log}</div>
                ))}
              </div>

              <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
              `}</style>
            </section>
          )}

          {/* Processing */}
          {step === 'processing' && (
            <section style={{ maxWidth: 600, margin: '0 auto', padding: '6rem 0', textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72,
                borderRadius: '50%',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent2)',
                margin: '0 auto 1.5rem',
                animation: 'spin 0.9s linear infinite',
              }} />
              <h2 className="font-display" style={{ fontSize: 36, marginBottom: '0.5rem' }}>MEMPROSES CLIP</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Menambahkan subtitle & mengekspor format Shorts (9:16)...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </section>
          )}

          {/* Results */}
          {step === 'results' && (
            <section style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 0' }}>
              {/* Video Info */}
              {videoInfo && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '2rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem 1.25rem',
                }}>
                  {videoInfo.thumbnail && (
                    <img src={videoInfo.thumbnail} alt="" style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 6 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{videoInfo.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Durasi: {formatTime(videoInfo.duration)}</div>
                  </div>
                  <button
                    onClick={() => { setStep('input'); setClips([]); setVideoInfo(null); setUrl('') }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 14px',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                  >↩ Ulang</button>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                  <h2 className="font-display" style={{ fontSize: 32 }}>HASIL CLIP AI</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{clips.length} momen terbaik ditemukan</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {clips.map((clip, idx) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    index={idx}
                    formatTime={formatTime}
                    onProcess={() => handleProcessClip(clip)}
                    processing={processingId === clip.id}
                    activePreview={activePreview}
                    setActivePreview={setActivePreview}
                  />
                ))}
              </div>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid var(--border)',
          padding: '1.5rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 12,
          fontFamily: 'Space Grotesk, sans-serif',
        }}>
          ClipShort AI — Dibuat dengan Next.js + Vercel + Anthropic Claude
        </footer>
      </div>
    </>
  )
}

function ClipCard({ clip, index, formatTime, onProcess, processing, activePreview, setActivePreview }: {
  clip: ClipResult
  index: number
  formatTime: (s: number) => string
  onProcess: () => void
  processing: boolean
  activePreview: string | null
  setActivePreview: (id: string | null) => void
}) {
  const scoreColor = clip.engagementScore > 80 ? '#22c55e' : clip.engagementScore > 60 ? '#f59e0b' : '#ef4444'
  const isPreviewOpen = activePreview === clip.id

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      transition: 'border-color 0.2s, transform 0.2s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-active)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
      }}
    >
      {/* Thumbnail / Preview area */}
      <div style={{
        position: 'relative',
        aspectRatio: '9/16',
        maxHeight: 200,
        background: 'var(--bg)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {clip.thumbnail ? (
          <img src={clip.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
        ) : (
          <div style={{ fontSize: 40, opacity: 0.3 }}>🎬</div>
        )}

        {/* Score badge */}
        <div style={{
          position: 'absolute',
          top: 10, right: 10,
          background: 'rgba(0,0,0,0.75)',
          borderRadius: 20,
          padding: '3px 10px',
          fontSize: 12,
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600,
          color: scoreColor,
          border: `1px solid ${scoreColor}40`,
        }}>🔥 {clip.engagementScore}%</div>

        {/* Clip number */}
        <div style={{
          position: 'absolute',
          top: 10, left: 10,
          background: 'var(--accent)',
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 11,
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 700,
          color: 'white',
        }}>CLIP #{index + 1}</div>

        {/* Subtitle preview overlay */}
        {clip.subtitles && clip.subtitles.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: 10, right: 10,
            background: 'rgba(0,0,0,0.8)',
            borderRadius: 4,
            padding: '4px 8px',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: 'white',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            fontFamily: 'Space Grotesk, sans-serif',
            lineHeight: 1.3,
          }}>
            {clip.subtitles[0].text}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '1rem' }}>
        {/* Hook Title */}
        <div style={{
          fontSize: 11,
          letterSpacing: '0.1em',
          color: 'var(--accent)',
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 600,
          textTransform: 'uppercase',
          marginBottom: '0.4rem',
        }}>🪝 Judul Hook</div>
        <h3 style={{
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.4,
          marginBottom: '0.75rem',
          fontFamily: 'Space Grotesk, sans-serif',
        }}>{clip.hookTitle}</h3>

        {/* Timing */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
        }}>
          <span style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 12,
            fontFamily: 'Space Grotesk, sans-serif',
            color: 'var(--text-mid)',
          }}>⏱ {formatTime(clip.startTime)} – {formatTime(clip.endTime)}</span>
          <span style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 12,
            fontFamily: 'Space Grotesk, sans-serif',
            color: 'var(--text-mid)',
          }}>📏 {clip.duration}s</span>
        </div>

        {/* Reason */}
        <p style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          marginBottom: '1rem',
        }}>{clip.reason}</p>

        {/* Subtitle list */}
        {isPreviewOpen && clip.subtitles && (
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.75rem',
            marginBottom: '1rem',
            maxHeight: 140,
            overflowY: 'auto',
          }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'Space Grotesk', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Preview Subtitle</div>
            {clip.subtitles.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)', minWidth: 40, fontFamily: 'monospace' }}>{formatTime(s.start)}</span>
                <span style={{ color: 'var(--text-mid)' }}>{s.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActivePreview(isPreviewOpen ? null : clip.id)}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.6rem',
              color: 'var(--text-mid)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'Space Grotesk, sans-serif',
              transition: 'all 0.15s',
            }}
          >{isPreviewOpen ? '▲ Tutup' : '👁 Preview Subtitle'}</button>

          {clip.downloadUrl ? (
            <a
              href={clip.downloadUrl}
              download={`clip-${index + 1}-shorts.mp4`}
              style={{
                flex: 1,
                background: 'var(--success)',
                border: 'none',
                borderRadius: 8,
                padding: '0.6rem',
                color: 'white',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 600,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >⬇ Download</a>
          ) : (
            <button
              onClick={onProcess}
              disabled={processing}
              style={{
                flex: 1,
                background: processing ? 'var(--bg-elevated)' : 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                padding: '0.6rem',
                color: processing ? 'var(--text-muted)' : 'white',
                fontSize: 12,
                cursor: processing ? 'not-allowed' : 'pointer',
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >{processing ? '⏳ Processing...' : '✂️ Buat Clip'}</button>
          )}
        </div>
      </div>
    </div>
  )
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
