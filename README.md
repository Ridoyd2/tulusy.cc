# Tulusy (tulusy.cc) - Universal File Converter & 5GB Anonymous Drop

A stylish, ultra-fast, full-stack web platform for converting **any image format** and **documents** (PDF to PPTX, PDF to DOCX, Images to PDF, etc.) with pixel-perfect precision and high visual fidelity.

---

## 🌟 Highlights & Capabilities

### 🖼️ 1. Universal Image & Camera RAW Converter ("Any to Any")
- **Modern & Standard Images**: `PNG`, `JPG/JPEG`, `WEBP`, `AVIF`, `JXL` (JPEG XL), `JP2` (JPEG 2000), `QOI`, `DDS`, `PPM`, `SVG`, `ICO`, `ICNS`, `CUR` (input), `BMP`, `TIFF`, `GIF`, `HEIC/HEIF`, `PSD` (input), `TGA`, `PDF`
- **Camera RAW Models (LibRaw)**: `CR2`, `CR3`, `NEF`, `ARW`, `DNG`, `RAF`, `ORF`, `RW2` -> convertible to JPG, PNG, WebP, AVIF, JXL, TIFF, PDF, and more
- **Granular Controls**:
  - Quality / Compression Slider (1% to 100%)
  - Custom Resize (Width & Height) with Aspect Ratio Lock
  - DPI configuration (72 Web, 150 Screen, 300 Print, 600 Ultra)
  - Color palette mode (Full Color or Black & White Grayscale with alpha preservation)
  - Transparency replacement background color for JPG, BMP, PPM, and PDF

### 📄 2. Document, Markup, E-Book & Structured Data Converter
- **PDF & Office**: `PDF`, `DOCX`, `PPTX`, `XLSX`, `CSV`, `TXT` (PDF to DOCX/PPTX/XLSX/CSV/MD/HTML/EPUB/Images, Images to PDF, DOCX/PPTX/XLSX/CSV/TXT to PDF)
- **Markup & E-Books**: `MD` (Markdown), `HTML`, `EPUB`, `RTF` (input) with sanitized HTML-to-PDF rendering and structured DOCX/EPUB generation
- **Structured Data**: Bidirectional `JSON`, `YAML`, `XML`, `CSV`, `XLSX`, `PDF`, and `TXT` with `defusedxml` XXE protection and ISO date handling

### ✨ 3. Modern, Stylish Glassmorphism UI
- Neon dark mode with frosted glass cards (`backdrop-blur-xl`), animated ambient glows, and micro-interactions.
- **Interactive Multi-File Dropzone**: Drag & drop multiple files, browse, or directly paste with `Ctrl + V` from clipboard.
- **Batch Processing Queue**: Individual thumbnail previews, format pickers, progress bars, settings gears, and status tags.
- **Batch Download & ZIP Packaging**: Single-click "Download All (ZIP)" or download individual files.
- **Confetti Celebration** on successful conversions.

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Start the Backend API (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
python run.py
```
*Backend runs at `http://127.0.0.1:8480` (Swagger docs at `http://127.0.0.1:8480/docs`)*

### 2. Start the Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev -- -p 3480
```
*Frontend runs at `http://localhost:3480`*

### 3. One-Command Launcher (PowerShell)
You can also launch both servers together:
```powershell
.\start_app.ps1
```

---

## 📁 Architecture Overview

```
toolsy4u/
├── backend/
│   ├── app/
│   │   ├── config.py                 # App settings & supported format matrices
│   │   ├── main.py                   # FastAPI app & CORS middleware
│   │   ├── routers/
│   │   │   ├── image_converter.py    # Single & batch image conversion endpoints
│   │   │   ├── document_converter.py # PDF to DOCX, PDF to PPTX, DOCX to PDF
│   │   │   └── pdf_tools.py          # Images-to-PDF, PDF-to-images & universal routing
│   │   └── services/
│   │       ├── image_service.py      # Pillow, HEIF, SVG, PSD, ICO conversion logic
│   │       ├── pdf_service.py        # PyMuPDF, pdf2docx, python-pptx conversion logic
│   │       └── utils.py              # File cleanup, tasks, and ZIP packager
│   ├── requirements.txt
│   ├── run.py                        # Server runner
│   └── tests/
│       └── test_conversions.py       # Automated conversion test suite
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css           # Glassmorphism, animations & glow styles
│   │   │   ├── layout.tsx            # Root layout & dark theme
│   │   │   └── page.tsx              # Universal Converter Studio main UI
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Header with health badge & quick filters
│   │   │   ├── Dropzone.tsx          # Multi-file drag/drop & Ctrl+V paste hero
│   │   │   ├── FileQueue.tsx         # File list, progress bars & batch actions
│   │   │   ├── FormatModal.tsx       # Searchable format selector modal
│   │   │   ├── SettingsModal.tsx     # Quality, resize, DPI & grayscale controls
│   │   │   ├── QuickTools.tsx        # Popular 1-click preset cards
│   │   │   ├── FeatureGrid.tsx       # Feature showcase
│   │   │   └── Footer.tsx            # Footer & privacy assurance
│   │   ├── lib/
│   │   │   ├── api.ts                # Backend API client & downloader
│   │   │   └── formatRegistry.ts     # Metadata for 30+ formats
│   │   └── types/
│   │       └── index.ts              # TypeScript interfaces
│   └── package.json
└── start_app.ps1                     # Dual-server startup script
```
