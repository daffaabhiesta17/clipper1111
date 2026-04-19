import type { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'

interface SubtitleEntry {
  start: number
  end: number
  text: string
}

interface ClipData {
  id: string
  startTime: number
  endTime: number
  hookTitle: string
  subtitles?: SubtitleEntry[]
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// Generate SRT subtitle file content
function generateSRT(subtitles: SubtitleEntry[], startTime: number): string {
  return subtitles.map((s, i) => {
    const adjustedStart = s.start - startTime
    const adjustedEnd = s.end - startTime
    return `${i + 1}\n${formatSRTTime(adjustedStart)} --> ${formatSRTTime(adjustedEnd)}\n${s.text}\n`
  }).join('\n')
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

// Generate ASS subtitle content (for styled subtitles burned into video)
function generateASS(subtitles: SubtitleEntry[], startTime: number): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Space Grotesk,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,80,80,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  const events = subtitles.map(s => {
    const adjStart = s.start - startTime
    const adjEnd = s.end - startTime
    return `Dialogue: 0,${formatASSTime(adjStart)},${formatASSTime(adjEnd)},Default,,0,0,0,,{\\an2\\blur3}${s.text}`
  }).join('\n')

  return header + events
}

function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

async function downloadAndProcess(
  videoUrl: string,
  clip: ClipData,
  outputPath: string,
  tmpDir: string
): Promise<void> {
  const ffmpeg = (await import('fluent-ffmpeg')).default
  const ffmpegPath = (await import('ffmpeg-static')).default
  const ytdl = await import('ytdl-core')

  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

  const videoReadableStream = ytdl.default(videoUrl, {
    quality: 'highestvideo',
    filter: 'audioandvideo',
  })

  const tmpVideoPath = path.join(tmpDir, `raw_${clip.id}.mp4`)
  const tmpAssPath = path.join(tmpDir, `subs_${clip.id}.ass`)

  // Write video stream to temp file
  await new Promise<void>((resolve, reject) => {
    const writeStream = fs.createWriteStream(tmpVideoPath)
    videoReadableStream.pipe(writeStream)
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
    videoReadableStream.on('error', reject)
  })

  // Write subtitles file
  if (clip.subtitles && clip.subtitles.length > 0) {
    const assContent = generateASS(clip.subtitles, clip.startTime)
    fs.writeFileSync(tmpAssPath, assContent, 'utf-8')
  }

  const duration = clip.endTime - clip.startTime
  const hasSubtitles = clip.subtitles && clip.subtitles.length > 0 && fs.existsSync(tmpAssPath)

  // FFmpeg command: clip + crop to 9:16 + burn subtitles
  await new Promise<void>((resolve, reject) => {
    let cmd = ffmpeg(tmpVideoPath)
      .setStartTime(clip.startTime)
      .setDuration(duration)

    if (hasSubtitles) {
      // Scale, crop to 9:16, then burn subtitles
      cmd = cmd.videoFilters([
        'scale=1080:1920:force_original_aspect_ratio=increase',
        'crop=1080:1920',
        `subtitles=${tmpAssPath}:force_style='FontName=Arial,FontSize=72,Bold=1,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=4,Shadow=2,Alignment=2,MarginV=120'`,
      ])
    } else {
      cmd = cmd.videoFilters([
        'scale=1080:1920:force_original_aspect_ratio=increase',
        'crop=1080:1920',
      ])
    }

    cmd
      .audioCodec('aac')
      .videoCodec('libx264')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })

  // Cleanup temp files
  try {
    fs.unlinkSync(tmpVideoPath)
    if (hasSubtitles) fs.unlinkSync(tmpAssPath)
  } catch (_) {}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url, clip } = req.body as { url: string; clip: ClipData }
  if (!url || !clip) return res.status(400).json({ error: 'url and clip required' })

  const videoId = extractVideoId(url)
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' })

  const clipId = `${videoId}_${clip.id}_${uuidv4().slice(0, 8)}`
  const outputDir = path.join(process.cwd(), 'public', 'clips')
  const tmpDir = os.tmpdir()

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputFilename = `${clipId}.mp4`
  const outputPath = path.join(outputDir, outputFilename)

  try {
    await downloadAndProcess(
      `https://www.youtube.com/watch?v=${videoId}`,
      clip,
      outputPath,
      tmpDir
    )

    const downloadUrl = `/clips/${outputFilename}`

    // Clean up old clips (keep only last 20)
    const files = fs.readdirSync(outputDir)
      .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)
    files.slice(20).forEach(f => {
      try { fs.unlinkSync(path.join(outputDir, f.name)) } catch (_) {}
    })

    return res.status(200).json({ downloadUrl, success: true })

  } catch (error) {
    console.error('Process error:', error)
    const msg = error instanceof Error ? error.message : 'Processing failed'
    return res.status(500).json({ error: msg })
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
    responseLimit: false,
  },
}
