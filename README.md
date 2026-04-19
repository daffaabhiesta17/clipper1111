# ✂️ ClipShort — AI YouTube to Shorts Clipper

**ClipShort** adalah web app AI yang secara otomatis mendeteksi momen paling viral dari video YouTube, lalu membuatnya menjadi clip format YouTube Shorts (9:16) lengkap dengan subtitle terbakar dan judul hook.

## ✨ Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| 🔥 **Most-Replayed Detection** | AI menganalisis transcript untuk menemukan momen yang paling sering di-replay |
| 🤖 **Claude AI Analysis** | Anthropic Claude menganalisis konteks & narasi untuk menemukan clip terbaik |
| 🎬 **Auto Subtitle** | Subtitle otomatis di-burn ke dalam video hasil clip |
| 🪝 **Hook Title Generator** | Judul yang secara psikologis menarik penonton untuk klik |
| 📥 **Download & Preview** | Preview subtitle dan download langsung dalam format MP4 |
| 📱 **Format 9:16** | Output otomatis di-crop ke format YouTube Shorts/TikTok/Reels |

---

## 🚀 Setup & Deploy

### 1. Clone Repository

```bash
git clone https://github.com/USERNAME/yt-clipper-shorts.git
cd yt-clipper-shorts
npm install
```

### 2. Buat `.env.local`

```bash
cp .env.example .env.local
```

Isi file `.env.local`:

```env
# WAJIB: Anthropic API Key untuk AI analysis
ANTHROPIC_API_KEY=sk-ant-...

# OPSIONAL: RapidAPI key (untuk fitur tambahan)
RAPIDAPI_KEY=your_key_here
```

Dapatkan Anthropic API Key di: https://console.anthropic.com

### 3. Jalankan Development

```bash
npm run dev
```

Buka http://localhost:3000

---

## 📦 Deploy ke Vercel

### Via GitHub (Recommended)

1. **Push ke GitHub:**
   ```bash
   git add .
   git commit -m "feat: initial clipshort app"
   git push origin main
   ```

2. **Import ke Vercel:**
   - Buka https://vercel.com/new
   - Klik **"Import Git Repository"**
   - Pilih repo `yt-clipper-shorts`
   - Klik **"Deploy"**

3. **Set Environment Variables di Vercel:**
   - Masuk ke project Settings → Environment Variables
   - Tambahkan:
     - `ANTHROPIC_API_KEY` = `sk-ant-...`
   - Klik Save & Redeploy

### Via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

---

## 🏗️ Arsitektur

```
yt-clipper/
├── pages/
│   ├── index.tsx          # Main UI
│   └── api/
│       ├── analyze.ts     # YouTube scraping + Claude AI analysis
│       └── process.ts     # FFmpeg clip processing + subtitle burn-in
├── styles/
│   └── globals.css        # Global styles
├── public/
│   └── clips/             # Generated clip files (gitignored)
├── vercel.json            # Vercel config (max function duration)
└── package.json
```

### Flow Proses

```
User input URL
    ↓
[API /analyze]
    ├── ytdl-core: ambil info video
    ├── youtube-transcript: ambil transcript
    └── Claude AI: analisis momen terbaik
         ↓ clips[]
[UI: tampilkan hasil]
    ↓ (user klik "Buat Clip")
[API /process]
    ├── ytdl-core: download video
    ├── generate ASS subtitle file
    └── FFmpeg: clip + crop 9:16 + burn subtitle
         ↓ /clips/output.mp4
[User: Download / Preview]
```

---

## 🎛️ Cara Kerja AI Detection

ClipShort menggunakan **Anthropic Claude** untuk:

1. **Membaca transcript lengkap** video YouTube
2. **Mengidentifikasi pola** yang biasanya memicu replay:
   - Reveal/twist yang mengejutkan
   - Puncak emosi (tawa, shock, inspirasi)
   - Pernyataan kontroversial atau quote-able
   - Step penting dalam tutorial
3. **Menentukan timing optimal** (30-60 detik per clip)
4. **Membuat judul hook** dengan prinsip psikologi: curiosity gap, social proof, controversy

---

## 🛠️ Teknologi

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Pure CSS (no Tailwind — custom design system)
- **AI**: Anthropic Claude Opus (analysis + title generation)
- **Video**: ytdl-core (download), FFmpeg (processing)
- **Transcript**: youtube-transcript
- **Deployment**: Vercel

---

## ⚠️ Catatan Penting

1. **Vercel free tier**: Function timeout 60s. Untuk processing video panjang, upgrade ke Pro (300s timeout)
2. **Storage**: File clip disimpan di `/public/clips/` — auto-cleanup setiap 20 file
3. **Copyright**: Pastikan hanya menggunakan video yang kamu miliki atau memiliki lisensi untuk di-edit
4. **Rate limits**: YouTube dapat membatasi request berlebihan. Gunakan secara wajar.

---

## 📄 License

MIT License — Bebas digunakan untuk proyek personal & komersial.
