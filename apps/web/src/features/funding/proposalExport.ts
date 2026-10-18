import { jsPDF } from 'jspdf';

export interface ProposalExportData {
  projectTitle: string;
  applicantName: string;
  applicantType: string;
  contactPerson: string;
  contactEmail: string;
  locationName: string;
  schemeName: string;
  funderName: string;
  schemeSourceUrl?: string;
  planName: string;
  planMeasures: string[];
  planDaysText: string;
  planCostNum: number;
  requestedAmount: number;
  ownContribution: number;
  gapToArrange: number;
  targetDays: string | number;
  baselineDays: string | number;
  goalSummaryText: string;
  funderNotes?: string;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates and downloads a clean, professional PDF document using jsPDF.
 */
export function exportProposalPDF(data: ProposalExportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header Banner
  doc.setFillColor(8, 119, 122); // WaterPilot Teal
  doc.rect(margin, y, contentWidth, 16, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('WATERPILOT · PROJECT FUNDING PROPOSAL', margin + 6, y + 10.5);

  y += 24;

  // Title & Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(16, 26, 64);
  const titleLines = doc.splitTextToSize(data.projectTitle, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(83, 99, 124);
  doc.text(`Applicant: ${data.applicantName} (${data.applicantType})`, margin, y);
  y += 5;
  doc.text(`Location: ${data.locationName} · Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, margin, y);
  y += 5;
  doc.text(`Target Scheme: ${data.schemeName} · Funder: ${data.funderName}`, margin, y);
  y += 8;

  // Section 01: Funding Request
  doc.setDrawColor(214, 225, 237);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(8, 119, 122);
  doc.text('01 · FUNDING REQUEST & SUMMARY', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const reqText = `We respectfully submit this formal grant application requesting Rs. ${data.requestedAmount.toLocaleString('en-IN')} towards community water resilience works under the ${data.schemeName}, sponsored by ${data.funderName}.`;
  const reqLines = doc.splitTextToSize(reqText, contentWidth);
  doc.text(reqLines, margin, y);
  y += reqLines.length * 5 + 4;

  // Section 02: Project Need & Objectives
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(8, 119, 122);
  doc.text('02 · PROJECT NEED & OBJECTIVES', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const needText = `The community at ${data.locationName} currently experiences a verified baseline shortage of ${data.baselineDays} days/year. The objective of this intervention is to ${data.goalSummaryText.toLowerCase()} to <= ${data.targetDays} days/year through systematic infrastructure upgrades and rainwater recharge.`;
  const needLines = doc.splitTextToSize(needText, contentWidth);
  doc.text(needLines, margin, y);
  y += needLines.length * 5 + 4;

  // Section 03: Proposed Works & Timeline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(8, 119, 122);
  doc.text('03 · PROPOSED TECHNICAL WORKS', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const worksText = `Selected Package: ${data.planName}. Implementation Timeline: ${data.planDaysText}.\nKey Interventions: ${data.planMeasures.length > 0 ? data.planMeasures.join(', ') : 'Rooftop rainwater harvesting, silt filtration and recharge wells'}.`;
  const worksLines = doc.splitTextToSize(worksText, contentWidth);
  doc.text(worksLines, margin, y);
  y += worksLines.length * 5 + 4;

  // Section 04: Budget Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(8, 119, 122);
  doc.text('04 · PROPOSED BUDGET BREAKDOWN', margin, y);
  y += 6;

  // Table background & border
  const tableY = y;
  const rowHeight = 7.5;
  const rows = [
    ['Total Estimated Project Cost', `Rs. ${data.planCostNum.toLocaleString('en-IN')}`],
    ['Requested Grant Support', `Rs. ${data.requestedAmount.toLocaleString('en-IN')}`],
    ['Planned Community Own Contribution', `Rs. ${data.ownContribution.toLocaleString('en-IN')}`],
    ['Remaining Balance to Arrange', `Rs. ${data.gapToArrange.toLocaleString('en-IN')}`],
  ];

  doc.setDrawColor(214, 225, 237);
  doc.setFillColor(244, 249, 252);
  doc.rect(margin, tableY, contentWidth, rowHeight * rows.length, 'F');
  doc.rect(margin, tableY, contentWidth, rowHeight * rows.length, 'S');

  rows.forEach(([label, amount], i) => {
    const curY = tableY + i * rowHeight;
    if (i > 0) {
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, curY, pageWidth - margin, curY);
    }
    const isBold = i === 0 || i === rows.length - 1;
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(16, 26, 64);
    doc.text(label, margin + 4, curY + 5);
    doc.text(amount, pageWidth - margin - 4, curY + 5, { align: 'right' });
  });

  y += rows.length * rowHeight + 8;

  // Section 05: Applicant Contact & Governance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(8, 119, 122);
  doc.text('05 · APPLICANT GOVERNANCE & CONTACT', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Authorized Contact: ${data.contactPerson || 'Authorized Representative'}`, margin, y);
  y += 5;
  doc.text(`Email Address: ${data.contactEmail || 'community@waterpilot.org'}`, margin, y);
  y += 5;
  if (data.funderNotes) {
    const notesLines = doc.splitTextToSize(`Submission Notes: ${data.funderNotes}`, contentWidth);
    doc.text(notesLines, margin, y);
    y += notesLines.length * 5;
  }
  if (data.schemeSourceUrl) {
    doc.text(`Official Funder Portal: ${data.schemeSourceUrl}`, margin, y);
    y += 5;
  }

  // Footer note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This draft proposal was compiled using verified baseline and technical data via WaterPilot (https://waterpilot.web.app).',
    margin,
    pageHeight - 12,
  );

  doc.save(`WaterPilot_Proposal_${sanitizeFileName(data.projectTitle)}.pdf`);
}

/**
 * Generates and downloads a rich, properly formatted Microsoft Word document (.doc).
 */
export function exportProposalWord(data: ProposalExportData): void {
  const safeTitle = sanitizeFileName(data.projectTitle);

  const wordContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(data.projectTitle)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1e293b;
      margin: 40pt;
    }
    .header-box {
      background-color: #f0fdfa;
      border-left: 5pt solid #0d9488;
      padding: 14pt 18pt;
      margin-bottom: 24pt;
    }
    .badge {
      display: inline-block;
      background-color: #ccfbf1;
      color: #0f766e;
      padding: 3pt 8pt;
      border-radius: 4pt;
      font-weight: bold;
      font-size: 9.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      margin-bottom: 6pt;
    }
    h1 {
      font-size: 20pt;
      color: #0f766e;
      margin: 4pt 0 6pt 0;
      line-height: 1.25;
    }
    .meta-line {
      font-size: 10pt;
      color: #64748b;
      margin: 0;
    }
    h2 {
      font-size: 12.5pt;
      color: #0f172a;
      margin-top: 20pt;
      margin-bottom: 8pt;
      border-bottom: 1.5pt solid #cbd5e1;
      padding-bottom: 4pt;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
    }
    p {
      margin: 0 0 10pt 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0 18pt 0;
    }
    th, td {
      border: 1pt solid #cbd5e1;
      padding: 8pt 12pt;
      text-align: left;
      font-size: 10.5pt;
    }
    th {
      background-color: #f8fafc;
      font-weight: bold;
      color: #334155;
    }
    .amount-cell {
      text-align: right;
      font-weight: 600;
      white-space: nowrap;
    }
    .highlight-row {
      background-color: #f0fdf4;
      font-weight: bold;
    }
    .footer {
      font-size: 9pt;
      color: #94a3b8;
      border-top: 1pt solid #e2e8f0;
      padding-top: 12pt;
      margin-top: 36pt;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="badge">WaterPilot Project Proposal</div>
    <h1>${escapeHtml(data.projectTitle)}</h1>
    <p class="meta-line">
      <strong>Applicant:</strong> ${escapeHtml(data.applicantName)} (${escapeHtml(data.applicantType)})<br/>
      <strong>Location:</strong> ${escapeHtml(data.locationName)} · <strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}<br/>
      <strong>Target Scheme:</strong> ${escapeHtml(data.schemeName)} (${escapeHtml(data.funderName)})
    </p>
  </div>

  <h2>01 · Funding Request</h2>
  <p>
    We respectfully submit this formal grant application requesting <strong>₹${data.requestedAmount.toLocaleString('en-IN')}</strong> towards community water security and replenishment works under the <strong>${escapeHtml(data.schemeName)}</strong>, administered by <strong>${escapeHtml(data.funderName)}</strong>.
  </p>

  <h2>02 · Project Need &amp; Objectives</h2>
  <p>
    The residential community at ${escapeHtml(data.locationName)} currently experiences an annual water shortage baseline of <strong>${escapeHtml(String(data.baselineDays))} days/year</strong>. The objective of this intervention is to <strong>${escapeHtml(data.goalSummaryText.toLowerCase())} to ≤ ${escapeHtml(String(data.targetDays))} days/year</strong> through systematic rooftop rainwater harvesting, filtration, and aquifer injection recharge.
  </p>

  <h2>03 · Proposed Technical Works</h2>
  <p>
    <strong>Selected Plan:</strong> ${escapeHtml(data.planName)}<br/>
    <strong>Target Implementation Timeline:</strong> ${escapeHtml(data.planDaysText)}<br/>
    <strong>Key Interventions Included:</strong> ${escapeHtml(data.planMeasures.length > 0 ? data.planMeasures.join(', ') : 'Rooftop rainwater harvesting, silt filtration and recharge wells')}
  </p>

  <h2>04 · Proposed Budget Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Budget Category</th>
        <th style="text-align: right;">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Total Estimated Project Cost</td>
        <td class="amount-cell">₹${data.planCostNum.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td>Requested Grant Support</td>
        <td class="amount-cell">₹${data.requestedAmount.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td>Planned Community Own Contribution</td>
        <td class="amount-cell">₹${data.ownContribution.toLocaleString('en-IN')}</td>
      </tr>
      <tr class="highlight-row">
        <td>Remaining Balance to Arrange</td>
        <td class="amount-cell">₹${data.gapToArrange.toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>

  <h2>05 · Applicant Contact &amp; Governance</h2>
  <p>
    <strong>Representative:</strong> ${escapeHtml(data.contactPerson || 'Authorized Representative')}<br/>
    <strong>Email:</strong> ${escapeHtml(data.contactEmail || 'community@waterpilot.org')}<br/>
    ${data.funderNotes ? `<strong>Submission Notes:</strong> ${escapeHtml(data.funderNotes)}<br/>` : ''}
    ${data.schemeSourceUrl ? `<strong>Official Funder Portal:</strong> <a href="${escapeHtml(data.schemeSourceUrl)}">${escapeHtml(data.schemeSourceUrl)}</a>` : ''}
  </p>

  <div class="footer">
    Compiled from verified community baseline data via WaterPilot (https://waterpilot.web.app). Grant approvals remain subject to official programme administrator review.
  </div>
</body>
</html>
`;

  const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `WaterPilot_Proposal_${safeTitle}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);
}
