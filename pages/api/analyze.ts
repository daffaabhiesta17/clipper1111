import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

// Helper to extract YouTube video ID
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

// Fetch transcript from YouTube using youtube-transcript
async function fetchTranscript(videoId: string) {
  try {
    // Dynamic import to avoid SSR issues
    const { YoutubeTranscript } = await import('youtube-transcript')
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    return transcript.map(t => ({
      text: t.text,
      start: t.offset / 1000,
      duration: t.duration / 1000,
    }))
  } catch (e) {
    console.error('Transcript error:', e)
    return null
  }
}

// Fetch YouTube video info using ytdl-core
async function fetchVideoInfo(videoId: string) {
  try {
    const ytdl = await import('ytdl-core')
    const info = await ytdl.default.getInfo(`https://www.youtube.com/watch?v=${videoId}`)
    const details = info.videoDetails
    return {
      title: details.title,
      duration: parseInt(details.lengthSeconds),
      thumbnail: details.thumbnails[details.thumbnails.length - 1]?.url || '',
      description: details.description?.slice(0, 1000) || '',
      viewCount: details.viewCount,
      keywords: details.keywords || [],
    }
  } catch (e) {
    console.error('Video info error:', e)
    return null
  }
}

// Build full transcript text for AI analysis
function buildTranscriptText(transcript: { text: string; start: number; duration: number }[]) {
  return transcript
    .map(t => `[${formatTime(t.start)}] ${t.text}`)
    .join('\n')
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// Use Claude AI to find the best clip moments
async function findBestClips(
  anthropic: Anthropic,
  videoInfo: { title: string; duration: number; description: string; keywords: string[] },
  transcriptText: string,
  transcript: { text: string; start: number; duration: number }[]
) {
  const prompt = `You are an expert YouTube Shorts creator and viral content analyst.

Analyze this YouTube video transcript and find the BEST moments to clip as YouTube Shorts.

VIDEO INFO:
Title: ${videoInfo.title}
Duration: ${formatTime(videoInfo.duration)} (${videoInfo.duration} seconds)
Description: ${videoInfo.description}
Keywords: ${videoInfo.keywords.slice(0, 10).join(', ')}

TRANSCRIPT:
${transcriptText.slice(0, 8000)}

Your task:
1. Find 3-5 segments that are MOST LIKELY to be "most replayed" by viewers — moments with:
   - High information density or surprising reveals
   - Emotional peaks (laughter, shock, inspiration, controversy)
   - Quotable statements or strong opinions
   - Tutorial steps or key tips
   - Story climaxes or plot twists

2. Each clip should be 30-60 seconds long (ideal for Shorts)

3. For each clip, generate:
   - A HOOK TITLE in Bahasa Indonesia that creates curiosity and makes people want to watch
   - Use psychological triggers: curiosity gap, social proof, urgency, controversy
   - Examples of good hooks: "Ternyata ini yang RAHASIA...", "Dia tidak tahu kamera masih ON", "Satu kesalahan yang bikin semua GAGAL"

Respond ONLY with valid JSON in this exact format:
{
  "clips": [
    {
      "id": "clip_1",
      "startTime": 45.0,
      "endTime": 95.0,
      "duration": 50,
      "hookTitle": "Hook title in Bahasa Indonesia here",
      "reason": "Why this moment has high replay value (in Bahasa Indonesia, 1-2 sentences)",
      "engagementScore": 85,
      "subtitles": [
        { "start": 45.0, "end": 48.5, "text": "First subtitle text" },
        { "start": 48.5, "end": 52.0, "text": "Second subtitle text" }
      ]
    }
  ]
}`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  
  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI did not return valid JSON')
  
  const parsed = JSON.parse(jsonMatch[0])
  return parsed.clips
}

// Fallback: generate clips from transcript without AI (if no API key)
function generateFallbackClips(
  transcript: { text: string; start: number; duration: number }[],
  videoDuration: number
) {
  const segments: { start: number; end: number; text: string; score: number }[] = []
  
  // Score each 45-second window
  for (let i = 0; i < transcript.length; i++) {
    const seg = transcript[i]
    const windowEnd = seg.start + 50
    const windowTranscript = transcript.filter(t => t.start >= seg.start && t.start <= windowEnd)
    
    if (windowTranscript.length < 3) continue
    
    // Score based on keywords that indicate high-value moments
    const text = windowTranscript.map(t => t.text).join(' ').toLowerCase()
    let score = 50
    
    const highValueWords = [
      'tapi', 'tapi tunggu', 'sebenarnya', 'rahasia', 'jangan', 'penting',
      'kesalahan', 'ternyata', 'wow', 'amazing', 'incredible', 'secret',
      'never', 'always', 'biggest', 'most', 'best', 'worst', 'crazy',
      'shocking', 'truth', 'lie', 'revealed', 'discovered', 'actually',
      'wait', 'stop', 'listen', 'important', 'critical', 'mistake'
    ]
    
    highValueWords.forEach(w => {
      if (text.includes(w)) score += 5
    })
    
    // Penalize if too close to start or end
    if (seg.start < 30) score -= 20
    if (seg.start > videoDuration - 60) score -= 10
    
    const endTime = Math.min(windowEnd, videoDuration)
    if (endTime - seg.start >= 25) {
      segments.push({ start: seg.start, end: endTime, text: text.slice(0, 100), score })
    }
  }
  
  // Sort by score and pick top 4 non-overlapping clips
  segments.sort((a, b) => b.score - a.score)
  
  const selected: typeof segments = []
  for (const seg of segments) {
    const overlaps = selected.some(s =>
      seg.start < s.end + 20 && seg.end > s.start - 20
    )
    if (!overlaps) {
      selected.push(seg)
      if (selected.length >= 4) break
    }
  }
  
  return selected.map((s, i) => {
    const clipTranscript = transcript.filter(t => t.start >= s.start && t.start <= s.end)
    const subtitles = clipTranscript.slice(0, 15).map(t => ({
      start: t.start,
      end: t.start + t.duration,
      text: t.text,
    }))
    
    return {
      id: `clip_${i + 1}`,
      startTime: s.start,
      endTime: s.end,
      duration: Math.round(s.end - s.start),
      hookTitle: `Momen Viral #${i + 1}: ${s.text.slice(0, 50)}...`,
      reason: 'Segmen ini mengandung konten bernilai tinggi berdasarkan analisis kata kunci dan posisi dalam video.',
      engagementScore: Math.min(95, s.score),
      subtitles,
    }
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL diperlukan' })

  const videoId = extractVideoId(url)
  if (!videoId) return res.status(400).json({ error: 'URL YouTube tidak valid' })

  try {
    // Step 1: Fetch video info
    const videoInfo = await fetchVideoInfo(videoId)
    if (!videoInfo) {
      return res.status(400).json({ error: 'Tidak dapat mengambil info video. Pastikan video bersifat publik.' })
    }

    // Step 2: Fetch transcript
    const transcript = await fetchTranscript(videoId)
    
    let clips

    if (transcript && transcript.length > 0) {
      const transcriptText = buildTranscriptText(transcript)
      
      // Step 3: Use Claude AI if API key is available
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (apiKey) {
        const anthropic = new Anthropic({ apiKey })
        clips = await findBestClips(anthropic, videoInfo, transcriptText, transcript)
        
        // Add thumbnail URL to each clip
        clips = clips.map((clip: { startTime: number; [key: string]: unknown }) => ({
          ...clip,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          previewReady: false,
        }))
      } else {
        // Fallback without AI
        clips = generateFallbackClips(transcript, videoInfo.duration)
        clips = clips.map((clip: { startTime: number; [key: string]: unknown }) => ({
          ...clip,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          previewReady: false,
        }))
      }
    } else {
      // No transcript available - create time-based clips
      const segmentSize = Math.floor(videoInfo.duration / 5)
      clips = [0.15, 0.3, 0.55, 0.75].map((pos, i) => {
        const startTime = Math.floor(videoInfo.duration * pos)
        const endTime = Math.min(startTime + 50, videoInfo.duration)
        return {
          id: `clip_${i + 1}`,
          startTime,
          endTime,
          duration: endTime - startTime,
          hookTitle: `Clip ${i + 1} dari "${videoInfo.title}"`,
          reason: 'Tidak ada transcript tersedia — clip dibuat berdasarkan distribusi waktu optimal.',
          engagementScore: 75 - i * 5,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          previewReady: false,
          subtitles: [],
        }
      })
    }

    return res.status(200).json({
      videoInfo: {
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
      },
      clips,
    })

  } catch (error) {
    console.error('Analyze error:', error)
    const msg = error instanceof Error ? error.message : 'Analisis gagal'
    return res.status(500).json({ error: msg })
  }
}
