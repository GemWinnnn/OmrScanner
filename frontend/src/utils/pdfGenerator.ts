// @ts-ignore -- html2pdf.js has no bundled TS types
import html2pdf from 'html2pdf.js'

type ExamInput = { name?: string; totalItems?: number }

export const getOMRLayout = () => {
  return {
    questionsPerColumn: 25,
    columns: 4,
    bubbleSpacing: 40,
    columnSpacing: 280,
    startX: 180,
    startY: 200,
    optionsPerQuestion: 5,
    totalQuestions: 100,
  }
}

export const generateOMRPDF = async (exam: ExamInput | string): Promise<void> => {
  const examObj: ExamInput = typeof exam === 'string' ? { name: exam } : exam

  try {
    const html = generateSinglePageHTML(examObj)

    const container = document.createElement('div')
    container.innerHTML = html
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    container.style.top = '0'
    // Match original template page size exactly for html2canvas layout.
    container.style.width = '612pt'
    container.style.height = '936pt'
    document.body.appendChild(container)

    const page = container.querySelector('.page')
    if (!page) {
      document.body.removeChild(container)
      throw new Error('Failed to render PDF template')
    }

    await html2pdf()
      .set({
        margin: 0,
        filename: `OMR_${(examObj.name || 'EXAMINATION').replace(/\s+/g, '_')}.pdf`,
        pagebreak: { mode: ['avoid-all', 'css'] },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 816,
          height: 1248,
        },
        jsPDF: {
          unit: 'pt',
          format: [612, 936],
          orientation: 'portrait',
        },
      })
      .from(page)
      .save()

    document.body.removeChild(container)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to generate PDF: ${msg}`)
  }
}

const generateSinglePageHTML = (exam: ExamInput) => {
  const maxQuestions = 100
  const questions = Array.from({ length: maxQuestions }, (_, i) => i + 1)

  const columns = [
    questions.slice(0, 25),
    questions.slice(25, 50),
    questions.slice(50, 75),
    questions.slice(75, 100),
  ]

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=612, initial-scale=1.0" />
  <style>
    /* ===== FORCE CUSTOM PAGE SIZE ===== */
    @page {
      size: 612pt 936pt; /* 8.5in x 13in in points */
      margin: 0; /* Critical: Remove all default margins */
    }

    @media print {
      html, body {
        width: 612pt;
        height: 936pt;
        margin: 0 !important;
        padding: 0 !important;
      }
    }

    /* ===== PAGE SETUP ===== */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 612pt;
      height: 936pt;
      margin: 0;
      padding: 0;
      font-family: 'Courier New', monospace;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 12pt; /* Reduced from 14pt */
    }

    /* ===== MARKERS ===== */
    .top-markers,
    .bottom-markers {
      display: flex;
      justify-content: space-between;
      width: 100%;
    }

    .top-markers {
      margin-bottom: 10pt;
    }

    .bottom-markers {
      display: flex;
      justify-content: space-between;
      width: 100%;
      padding-top: 5pt;
    }

    .marker {
      width: 18px;
      height: 18px;
      background: #000;
      flex-shrink: 0;
    }

    /* ===== HEADER ===== */
    .header {
      text-align: center;
      border: 3px solid #000;
      padding: 6pt;
      margin-bottom: 6pt;
      background: #f8f9fa;
    }

    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 2pt;
      letter-spacing: 0.5pt;
    }

    .total-items {
      font-size: 10pt;
      font-weight: bold;
    }

    /* ===== INSTRUCTIONS ===== */
    .instructions {
      border: 2px solid #000;
      padding: 6pt 10pt;
      margin-bottom: 6pt;
      background: #fffef7;
      font-size: 8pt;
      line-height: 1.4;
    }

    .instructions-title {
      font-weight: bold;
      font-size: 10pt;
      margin-bottom: 3pt;
      text-decoration: underline;
    }

    .instructions ul {
      margin-left: 15pt;
      margin-top: 2pt;
    }

    .instructions li {
      margin-bottom: 1pt;
    }

    .instructions strong {
      font-weight: bold;
    }

    /* ===== INFO SECTION ===== */
    .info-section {
      border: 2px solid #000;
      padding: 6pt 8pt;
      margin-bottom: 8pt;
      display: flex;
      gap: 10pt;
      align-items: center;
    }

    .student-fields {
      display: flex;
      gap: 10pt;
      flex: 1;
    }

    .field {
      display: flex;
      gap: 4pt;
      align-items: center;
      flex: 1;
    }

    .field-label {
      font-weight: bold;
      font-size: 9pt;
      white-space: nowrap;
    }

    .field-line {
      flex: 1;
      border-bottom: 2px solid #000;
      height: 14pt;
    }

    .score-box {
      padding: 4pt 10pt;
      display: flex;
      gap: 6pt;
      align-items: center;
    }

    .score-label {
      font-weight: bold;
      font-size: 9pt;
    }

    .score-value {
      font-weight: bold;
      font-size: 9pt;
      border-bottom: 2px solid #000;
      min-width: 60pt;
      text-align: center;
      padding: 1pt;
    }

    /* ===== ANSWER GRID ===== */
    .content {
      display: flex;
      flex-direction: column;
    }

    .grid {
      display: flex;
      justify-content: space-between;
      gap: 8pt;
    }

    .column {
      border: 2px solid #000;
      padding: 6pt 5pt;
      width: 24%;
      display: flex;
      flex-direction: column;
      gap: 1.5pt;
    }

    .row {
      display: flex;
      align-items: center;
      white-space: nowrap;
    }

    .q-num {
      font-size: 10pt;
      font-weight: bold;
      width: 28pt;
      text-align: right;
      margin-right: 5pt;
    }

    .bubbles {
      display: flex;
      gap: 5pt;
      align-items: flex-start;
    }

    .bubble-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1pt;
    }

    .bubble {
      width: 18px;
      height: 18px;
      border: 2px solid #000;
      border-radius: 50%;
      background: white;
    }

    .opt-label {
      font-size: 8pt;
      font-weight: bold;
      line-height: 1;
      display: block;
      margin-bottom: 3pt;
    }

    /* Prevent page breaks */
    .page, .grid, .column {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>

<body>
  <div class="page">

    <!-- TOP MARKERS -->
    <div class="top-markers">
      <div class="marker"></div>
      <div class="marker"></div>
    </div>

    <!-- HEADER -->
    <div class="header">
      <h1>${escapeHtml(exam.name || 'EXAMINATION')}</h1>
      <div class="total-items">Total Items: ${exam.totalItems ?? 100}</div>
    </div>

    <!-- INSTRUCTIONS -->
    <div class="instructions">
      <div class="instructions-title">INSTRUCTIONS - READ CAREFULLY</div>
      <ul>
        <li>Use <strong>HB pencil (#2 pencil) ONLY</strong>. Do not use pen or markers.</li>
        <li><strong>Completely shade</strong> the circle of your chosen answer until it is dark and full.</li>
        <li><strong>Do not fold, tear, or make any unnecessary marks</strong> on this answer sheet.</li>
      </ul>
    </div>

    <!-- INFO -->
    <div class="info-section">
      <div class="student-fields">
        <div class="field">
          <span class="field-label">NAME:</span>
          <div class="field-line"></div>
        </div>
        <div class="field">
          <span class="field-label">SECTION:</span>
          <div class="field-line"></div>
        </div>
        <div class="field">
          <span class="field-label">DATE:</span>
          <div class="field-line"></div>
        </div>
      </div>

      <div class="score-box">
        <span class="score-label">SCORE:</span>
        <div class="score-value">______ / 100</div>
      </div>
    </div>

    <div class="content">
      <!-- ANSWER GRID -->
      <div class="grid">
        ${columns.map(col => `
          <div class="column">
            ${col.map(q => `
              <div class="row">
                <span class="q-num">${q}.</span>
                <div class="bubbles">
                  ${['A','B','C','D','E'].map(opt => `
                    <div class="bubble-wrap">
                      <span class="opt-label">${opt}</span>
                      <div class="bubble"></div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- BOTTOM MARKERS -->
    <div class="bottom-markers">
      <div class="marker"></div>
      <div class="marker"></div>
    </div>

  </div>
</body>
</html>
`
}

const escapeHtml = (text: string) => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}
