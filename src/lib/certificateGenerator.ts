/**
 * Certificate generator — renders an HTML template (matching the provided
 * design spec) off-screen using html2canvas, then exports as PNG/PDF.
 */

interface CertificateData {
  studentName: string;
  studentEmail: string;
  courseName: string;
  issuedDate: string;
  certificateNumber: string;
  titleText: string;
  descText: string;
  issuerName: string;
  backgroundImageUrl?: string | null;
  branchName?: string | null;
  teamName?: string | null;
  language?: "ko" | "en";
}

// festcert wordmark is rendered as text in the certificate header to avoid
// html2canvas CORS issues with raster image imports.

// Pretendard font is only required for certificate rendering. Lazy-inject the
// CDN <link> the first time a certificate is generated to keep this CSS off
// the critical path of every other page.
const PRETENDARD_HREF =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";
let pretendardInjected = false;
const ensurePretendardLoaded = async () => {
  if (pretendardInjected) return;
  pretendardInjected = true;
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[href="${PRETENDARD_HREF}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = PRETENDARD_HREF;
  document.head.appendChild(link);
  // Wait briefly so html2canvas captures the font; fall back if onload never fires.
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    link.addEventListener("load", done, { once: true });
    link.addEventListener("error", done, { once: true });
    setTimeout(done, 1500);
  });
};

const LABELS = {
  ko: {
    certNoLabel: "Certificate No.",
    titleKo: "수 료 증",
    titleEn: "Certificate of Completion",
    bodyPrefix: "위 사람은 ",
    bodySuffix: "을(를) 성실히 이수하였기에",
    bodyLine2: "이 증서를 수여합니다.",
    fName: "이름",
    fId: "아이디",
    fBranch: "소속 지사",
    fTeam: "소속 팀",
    fCourse: "과정명",
    fDate: "수료 일자",
  },
  en: {
    certNoLabel: "Certificate No.",
    titleKo: "Certificate",
    titleEn: "Certificate of Completion",
    bodyPrefix: "This is to certify that the recipient has diligently completed ",
    bodySuffix: "",
    bodyLine2: "and is hereby awarded this certificate.",
    fName: "Name",
    fId: "ID",
    fBranch: "Branch",
    fTeam: "Team",
    fCourse: "Course",
    fDate: "Issued Date",
  },
} as const;

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function buildCertificateHtml(data: CertificateData): HTMLElement {
  const lang: "ko" | "en" = data.language === "en" ? "en" : "ko";
  const L = LABELS[lang];

  const titleKo = data.titleText?.trim() || L.titleKo;
  const courseName = escapeHtml(data.courseName || "-");

  const root = document.createElement("div");
  // Off-screen container so html2canvas can capture it without flashing the UI
  root.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: 794px;
    z-index: -1;
    pointer-events: none;
    font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #191F28;
  `;

  root.innerHTML = `
    <div id="cert-card" style="
      background: #fff;
      width: 794px;
      height: 561px;
      padding: 56px 80px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 8px 48px rgba(0,0,0,0.08);
      box-sizing: border-box;
    ">
      <!-- Left blue rule -->
      <div style="position:absolute; left:0; top:0; bottom:0; width:6px; background:#3182F6;"></div>

      <!-- Decorative ring (bottom-right) -->
      <div style="
        position:absolute; right:-80px; bottom:-80px;
        width:280px; height:280px; border-radius:50%;
        border:40px solid #F2F8FF; pointer-events:none;
      "></div>

      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; position:relative; z-index:1;">
        <div style="display:flex; align-items:center; height:32px;">
          <div style="height:32px; display:flex; align-items:center; font-family:'Pretendard','Noto Sans KR',sans-serif; font-weight:800; font-size:22px; letter-spacing:0.02em; color:#1a3a8c;">fest<span style="color:#e05a1e;">cert</span></div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px; color:#8B95A1; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:3px;">
            ${escapeHtml(L.certNoLabel)}
          </div>
          <div style="font-size:12px; color:#4E5968; font-weight:600; letter-spacing:0.04em;">
            ${escapeHtml(data.certificateNumber || "-")}
          </div>
        </div>
      </div>

      <!-- Title -->
      <div style="margin-bottom:28px; position:relative; z-index:1;">
        <div style="font-size:36px; font-weight:600; color:#191F28; letter-spacing:-0.02em; line-height:1; margin-bottom:14px;">
          ${escapeHtml(titleKo)}
        </div>
        <div style="font-size:12px; font-weight:500; color:#B0B8C1; letter-spacing:0.12em; text-transform:uppercase;">
          ${escapeHtml(L.titleEn)}
        </div>
      </div>

      <!-- Body -->
      <div style="
        font-size:14px; color:#4E5968; font-weight:400; line-height:1.8;
        margin-bottom:28px; padding-left:16px;
        position:relative; z-index:1;
      ">
        <span style="
          position:absolute; left:0; top:6px; bottom:6px;
          width:3px; background:#D1E5FF; border-radius:2px;
        "></span>
        ${escapeHtml(L.bodyPrefix)}<span style="color:#191F28; font-weight:700;">${courseName}</span>${escapeHtml(L.bodySuffix)}<br>
        ${escapeHtml(L.bodyLine2)}
      </div>

      <!-- Info grid -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px 40px; margin-bottom:0; position:relative; z-index:1;">
        ${renderField(L.fName, data.studentName, true)}
        ${renderField(L.fId, data.studentEmail)}
        ${renderField(L.fBranch, data.branchName || "-")}
        ${renderField(L.fTeam, data.teamName || "-")}
        ${renderField(L.fCourse, data.courseName)}
        ${renderField(L.fDate, data.issuedDate)}
      </div>
    </div>
  `;

  return root;
}

function renderField(label: string, value: string, accent = false): string {
  const valColor = accent ? "#3182F6" : "#191F28";
  return `
    <div>
      <div style="font-size:10px; font-weight:600; color:#8B95A1; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:4px;">
        ${escapeHtml(label)}
      </div>
      <div style="font-size:14px; font-weight:600; color:${valColor}; border-bottom:1px solid #E5E8EB; padding-bottom:6px;">
        ${escapeHtml(value || "-")}
      </div>
    </div>
  `;
}

async function renderToCanvas(data: CertificateData): Promise<HTMLCanvasElement> {
  await ensurePretendardLoaded();
  const html2canvas = (await import("html2canvas")).default;
  const wrapper = buildCertificateHtml(data);
  document.body.appendChild(wrapper);

  // Allow web fonts (Pretendard / Noto Sans KR) to settle
  try {
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
  } catch {
    /* ignore */
  }

  try {
    const card = wrapper.querySelector("#cert-card") as HTMLElement;
    return await html2canvas(card, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
  } finally {
    document.body.removeChild(wrapper);
  }
}

export const generateCertificateImage = async (
  data: CertificateData,
): Promise<Blob> => {
  const canvas = await renderToCanvas(data);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png", 1.0);
  });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Generate certificate as a PDF (A4 landscape) and trigger download.
 */
export const downloadCertificatePDF = async (
  data: CertificateData,
  filename: string,
) => {
  const { jsPDF } = await import("jspdf");
  const canvas = await renderToCanvas(data);
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
  pdf.save(filename);
};

/**
 * Render certificate to a PDF Blob (A4 landscape). Useful for bundling many
 * certificates into a single ZIP archive.
 */
export const generateCertificatePDFBlob = async (
  data: CertificateData,
): Promise<Blob> => {
  const { jsPDF } = await import("jspdf");
  const canvas = await renderToCanvas(data);
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
  return pdf.output("blob");
};

/**
 * Generate certificate image and return an object URL for previewing.
 * Caller is responsible for revoking the URL.
 */
export const generateCertificatePreviewUrl = async (
  data: CertificateData,
): Promise<string> => {
  const blob = await generateCertificateImage(data);
  return URL.createObjectURL(blob);
};