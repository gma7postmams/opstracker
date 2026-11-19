"use client";

import type { jsPDF as JsPDF } from "jspdf";
import { priorityLabel, statusLabel } from "./recordTypes";
import type { RecordType } from "./recordTypes";

type WorkLog = {
  id: number;
  type: "INVESTIGATION" | "RESOLUTION" | "REMARK";
  message: string;
  createdByName: string;
  createdAt: string;
};

type SystemEvent = {
  id: string | number;
  title: string;
  description: string;
  createdAt: string;
};

type Branding = {
  title?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
};

type ReportField = [string, unknown];
type SummaryGroup = { title: string; fields: ReportField[] };
type CardEntry = { label: string; content: unknown; signature?: string };

const DEFAULT_TITLE = "MAMS Support Operations Tracker";
const DEFAULT_TAGLINE = "Technical assistance and task logging";
const PAGE_MARGIN = 16;
const FOOTER_RESERVE = 24;
const TEXT_COLOR = [38, 52, 61] as const;
const MUTED_COLOR = [94, 111, 119] as const;
const BRAND_COLOR = [22, 93, 89] as const;
const BORDER_COLOR = [213, 224, 225] as const;
const PALE_COLOR = [244, 249, 248] as const;

const workLogLabels: Record<WorkLog["type"], string> = {
  INVESTIGATION: "Investigation",
  RESOLUTION: "Resolution",
  REMARK: "Remarks",
};

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function datePart(value: unknown) {
  if (!hasValue(value)) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function formatDate(value: unknown) {
  const raw = datePart(value);
  if (!raw) return "";
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatGeneratedAt(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function wallClockDate(date: unknown, time: unknown) {
  const day = datePart(date);
  if (!day || !hasValue(time)) return null;
  const parsed = new Date(`${day}T${String(time)}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function durationLabel(minutes: number) {
  const roundedMinutes = Math.max(0, minutes);
  return `${roundedMinutes} ${roundedMinutes === 1 ? "Minute" : "Minutes"}`;
}

function ownerName(record: any) {
  if (!record.owner) return "a deleted user";
  return [
    record.owner.firstName,
    record.owner.middleInitial ? `${record.owner.middleInitial}.` : "",
    record.owner.surname,
  ].filter(Boolean).join(" ") || "a deleted user";
}

async function loadLogoData(logoUrl: string | null | undefined) {
  if (!logoUrl || typeof window === "undefined") return null;

  let objectUrl = "";
  try {
    const url = new URL(logoUrl, window.location.origin);
    if (url.origin !== window.location.origin) return null;

    const response = await fetch(url.href, { credentials: "same-origin" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const supportedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];
    if (!supportedTypes.includes(blob.type.toLowerCase()) || blob.size > 2 * 1024 * 1024) return null;

    objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Logo image could not be decoded"));
      image.src = objectUrl;
    });

    if (!image.naturalWidth || !image.naturalHeight) return null;
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      data: canvas.toDataURL("image/png"),
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function recordSummary(type: RecordType, record: any): SummaryGroup[] {
  return [
    {
      title: "Record Information",
      fields: [
        ["Reference Number", record.refNo],
        ["Record Type", type === "assistance" ? "Technical Assistance" : "Other Task"],
        ["Status", hasValue(record.status) ? statusLabel(String(record.status)) : record.status],
        ["Priority", hasValue(record.priority) ? priorityLabel(String(record.priority)) : record.priority],
      ],
    },
    {
      title: "Operational Information",
      fields: [
        ["Date", formatDate(record.startDate)],
        ["Shift", record.shift],
        ["Location", record.location],
        ["Show / Group", record.showGroup],
        [type === "assistance" ? "Category" : "Activity Type", type === "assistance" ? record.category : record.activityType],
      ],
    },
    {
      title: "Assignment Information",
      fields: [
        ...(type === "assistance" ? [["Client", record.clientName] as ReportField] : []),
        ["Record Owner", ownerName(record)],
      ],
    },
  ];
}

function workExecution(record: any) {
  const startedAt = wallClockDate(record.startDate, record.timeStarted);
  const endedAt = record.status === "OPEN"
    ? new Date()
    : wallClockDate(record.endDate ?? record.startDate, record.timeEnded);
  const elapsedMinutes = startedAt
    ? Math.floor(((record.status === "OPEN" ? Date.now() : endedAt?.getTime() ?? startedAt.getTime()) - startedAt.getTime()) / 60000)
    : 0;

  return [
    ["Start Time", startedAt ? formatDateTime(startedAt) : "Not recorded"],
    ["End Time", record.status === "OPEN" ? "Ongoing" : endedAt ? formatDateTime(endedAt) : "Not recorded"],
    ["Resolution Time", durationLabel(elapsedMinutes)],
  ] as ReportField[];
}

function setFont(pdf: JsPDF, style: "normal" | "bold" | "italic", size: number, color: readonly number[]) {
  pdf.setFont("helvetica", style);
  pdf.setFontSize(size);
  pdf.setTextColor(color[0], color[1], color[2]);
}

function drawHeader(
  pdf: JsPDF,
  type: RecordType,
  record: any,
  branding: Branding,
  logo: Awaited<ReturnType<typeof loadLogoData>>,
  generatedAt: Date,
  pageWidth: number,
) {
  const title = hasValue(branding.title) ? String(branding.title) : DEFAULT_TITLE;
  const tagline = hasValue(branding.tagline) ? String(branding.tagline) : DEFAULT_TAGLINE;
  const logoBox = 23;
  let logoRendered = false;

  if (logo) {
    const ratio = logo.width / logo.height;
    const width = ratio >= 1 ? logoBox : logoBox * ratio;
    const height = ratio >= 1 ? logoBox / ratio : logoBox;
    try {
      pdf.addImage(logo.data, "PNG", PAGE_MARGIN + (logoBox - width) / 2, PAGE_MARGIN + (logoBox - height) / 2, width, height);
      logoRendered = true;
    } catch {
      logoRendered = false;
    }
  }

  const textX = PAGE_MARGIN + (logoRendered ? logoBox + 7 : 0);
  const textWidth = pageWidth - PAGE_MARGIN - textX;
  setFont(pdf, "bold", 13, BRAND_COLOR);
  pdf.text(pdf.splitTextToSize(title, textWidth)[0], textX, PAGE_MARGIN + 4);
  setFont(pdf, "normal", 8.5, MUTED_COLOR);
  const taglineLines = pdf.splitTextToSize(tagline, textWidth) as string[];
  pdf.text(taglineLines.slice(0, 2), textX, PAGE_MARGIN + 9);

  const reportTitle = type === "assistance" ? "TECHNICAL ASSISTANCE REPORT" : "OTHER TASK REPORT";
  setFont(pdf, "bold", 14, TEXT_COLOR);
  pdf.text(reportTitle, PAGE_MARGIN, PAGE_MARGIN + 32);
  setFont(pdf, "normal", 8.5, MUTED_COLOR);
  pdf.text(`Reference No.  ${String(record.refNo)}`, PAGE_MARGIN, PAGE_MARGIN + 38);
  pdf.text(`Generated: ${formatGeneratedAt(generatedAt)}`, pageWidth - PAGE_MARGIN, PAGE_MARGIN + 38, { align: "right" });

  pdf.setDrawColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  pdf.setLineWidth(0.7);
  pdf.line(PAGE_MARGIN, PAGE_MARGIN + 42, pageWidth - PAGE_MARGIN, PAGE_MARGIN + 42);
  return PAGE_MARGIN + 48;
}

function createRenderer(pdf: JsPDF, pageWidth: number, pageHeight: number, startY: number) {
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const contentBottom = pageHeight - FOOTER_RESERVE;
  const lineHeight = 4.3;
  let y = startY;

  const addPage = () => {
    pdf.addPage();
    y = PAGE_MARGIN;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= contentBottom) return false;
    addPage();
    return true;
  };

  const section = (title: string, initialContentHeight = 10) => {
    ensureSpace(13 + initialContentHeight);
    y += 3;
    pdf.setFillColor(PALE_COLOR[0], PALE_COLOR[1], PALE_COLOR[2]);
    pdf.rect(PAGE_MARGIN, y - 4.3, contentWidth, 8, "F");
    setFont(pdf, "bold", 9.5, BRAND_COLOR);
    pdf.text(title.toUpperCase(), PAGE_MARGIN + 2, y + 0.3);
    y += 8;
  };

  const renderGrid = (fields: ReportField[], columns = 2, highlightedLabels: string[] = [], labelFontSize = 7) => {
    const visibleFields = fields.filter(([, value]) => hasValue(value));
    const gap = 2;
    const cellWidth = (contentWidth - gap * (columns - 1)) / columns;

    for (let index = 0; index < visibleFields.length; index += columns) {
      const row = visibleFields.slice(index, index + columns);
      const cells = row.map(([label, value]) => {
        const text = String(value);
        setFont(pdf, "normal", 8.5, TEXT_COLOR);
        const lines = pdf.splitTextToSize(text, cellWidth - 6) as string[];
        return { label, lines };
      });
      const maxLineCount = Math.max(...cells.map((cell) => cell.lines.length));
      const fullRowHeight = 8 + maxLineCount * 3.8;
      if (fullRowHeight + 1 <= contentBottom - PAGE_MARGIN) ensureSpace(fullRowHeight + 1);

      let lineOffset = 0;
      while (lineOffset < maxLineCount) {
        const availableLines = Math.floor((contentBottom - y - 9) / 3.8);
        if (availableLines < 1) {
          ensureSpace(13);
          continue;
        }
        const segmentLineCount = Math.min(maxLineCount - lineOffset, availableLines);
        const rowHeight = 8 + segmentLineCount * 3.8;

        cells.forEach((cell, cellIndex) => {
          const x = PAGE_MARGIN + cellIndex * (cellWidth + gap);
          const highlighted = highlightedLabels.includes(visibleFields[index + cellIndex]?.[0] ?? "");
          const fill = highlighted ? [231, 243, 240] : [250, 252, 252];
          pdf.setFillColor(fill[0], fill[1], fill[2]);
          pdf.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
          pdf.setLineWidth(0.25);
          pdf.rect(x, y, cellWidth, rowHeight, "FD");
          const label = String(visibleFields[index + cellIndex]?.[0] ?? "");
          setFont(pdf, "bold", labelFontSize, MUTED_COLOR);
          pdf.text(lineOffset ? `${label.toUpperCase()} (CONTINUED)` : label.toUpperCase(), x + 3, y + 4);
          setFont(pdf, "normal", 8.5, TEXT_COLOR);
          pdf.text(cell.lines.slice(lineOffset, lineOffset + segmentLineCount), x + 3, y + 8.4);
        });

        y += rowHeight + 1;
        lineOffset += segmentLineCount;
        if (lineOffset < maxLineCount) ensureSpace(13);
      }
    }
    y += 1;
  };

  const renderSummaryGroups = (groups: SummaryGroup[]) => {
    for (const group of groups) {
      const fields = group.fields.filter(([, value]) => hasValue(value));
      if (!fields.length) continue;
      ensureSpace(20);
      y += 1.5;
      setFont(pdf, "bold", 7.5, MUTED_COLOR);
      pdf.text(group.title.toUpperCase(), PAGE_MARGIN + 1, y + 2.8);
      y += 5;
      renderGrid(fields);
    }
  };

  const renderSharedCard = (title: string, entries: CardEntry[]) => {
    const visibleEntries = entries.filter((entry) => hasValue(entry.content));
    if (!visibleEntries.length) return;

    const cardLeft = PAGE_MARGIN;
    const cardRight = pageWidth - PAGE_MARGIN;
    const cardWidth = cardRight - cardLeft;
    const inset = 4;
    const headerHeight = 8;
    const cardLineHeight = 4.1;
    let currentSegmentTop = y;
    const preparedEntries = visibleEntries.map((entry) => ({
      labelLines: pdf.splitTextToSize(entry.label, cardWidth - inset * 2) as string[],
      contentLines: pdf.splitTextToSize(String(entry.content), cardWidth - inset * 2) as string[],
      signatureLines: hasValue(entry.signature)
        ? pdf.splitTextToSize(`- ${entry.signature}`, cardWidth - inset * 2) as string[]
        : [],
    }));
    const entryHeight = (entry: typeof preparedEntries[number]) =>
      (entry.labelLines.length + entry.contentLines.length + entry.signatureLines.length) * cardLineHeight + 2;

    const drawSegmentHeader = (continued: boolean) => {
      currentSegmentTop = y;
      pdf.setFillColor(PALE_COLOR[0], PALE_COLOR[1], PALE_COLOR[2]);
      pdf.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
      pdf.setLineWidth(0.3);
      pdf.rect(cardLeft, y, cardWidth, headerHeight, "FD");
      setFont(pdf, "bold", 8.5, BRAND_COLOR);
      pdf.text(continued ? `${title.toUpperCase()} (CONTINUED)` : title.toUpperCase(), cardLeft + inset, y + 5.2);
      y += headerHeight;
    };

    const closeSegment = () => {
      pdf.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
      pdf.setLineWidth(0.3);
      pdf.line(cardLeft, currentSegmentTop, cardLeft, y);
      pdf.line(cardRight, currentSegmentTop, cardRight, y);
      pdf.line(cardLeft, y, cardRight, y);
    };

    const continueCard = () => {
      closeSegment();
      addPage();
      drawSegmentHeader(true);
    };

    const ensureCardSpace = (height: number) => {
      if (y + height > contentBottom) continueCard();
    };

    const firstEntryHeight = entryHeight(preparedEntries[0]);
    const firstEntryReservation = firstEntryHeight <= contentBottom - PAGE_MARGIN - headerHeight
      ? firstEntryHeight
      : cardLineHeight * 2;
    ensureSpace(headerHeight + firstEntryReservation);
    drawSegmentHeader(false);

    preparedEntries.forEach((prepared, entryIndex) => {
      const currentEntryHeight = entryHeight(prepared);
      if (entryIndex > 0) {
        const entryReservation = currentEntryHeight <= contentBottom - PAGE_MARGIN - headerHeight
          ? currentEntryHeight
          : cardLineHeight * 2;
        ensureCardSpace(4 + entryReservation);
        pdf.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        pdf.setLineWidth(0.25);
        pdf.line(cardLeft + inset, y + 1, cardRight - inset, y + 1);
        y += 4;
      }

      for (const labelLine of prepared.labelLines) {
        ensureCardSpace(cardLineHeight);
        setFont(pdf, "bold", 8, BRAND_COLOR);
        pdf.text(labelLine, cardLeft + inset, y + 3.1);
        y += cardLineHeight;
      }

      prepared.contentLines.forEach((contentLine, lineIndex) => {
        const signatureHeight = lineIndex === prepared.contentLines.length - 1
          ? prepared.signatureLines.length * cardLineHeight
          : 0;
        ensureCardSpace(cardLineHeight + signatureHeight);
        setFont(pdf, "normal", 8.8, TEXT_COLOR);
        pdf.text(contentLine, cardLeft + inset, y + 3.1);
        y += cardLineHeight;
      });

      for (const signatureLine of prepared.signatureLines) {
        ensureCardSpace(cardLineHeight);
        setFont(pdf, "italic", 8, MUTED_COLOR);
        pdf.text(signatureLine, cardRight - inset, y + 3.1, { align: "right" });
        y += cardLineHeight;
      }
      y += 2;
    });

    closeSegment();
    y += 3;
  };

  const renderTimeline = (systemEvents: SystemEvent[], workLogs: WorkLog[]) => {
    const events = [
      ...systemEvents.map((event) => ({
        createdAt: event.createdAt,
        action: event.title === "Reopened"
          ? event.description
          : [event.title, event.description].filter(Boolean).join(" — "),
        user: "",
      })),
      ...workLogs.map((entry) => ({
        createdAt: entry.createdAt,
        action: `${workLogLabels[entry.type]}: ${entry.message}`,
        user: entry.createdByName,
      })),
    ].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

    if (!events.length) return;
    section("Activity Timeline", 17);

    const columnWidths = [34, 106, contentWidth - 140];
    const headerHeight = 8;
    const rowLineHeight = 4.1;
    const drawTimelineHeader = () => {
      pdf.setFillColor(PALE_COLOR[0], PALE_COLOR[1], PALE_COLOR[2]);
      pdf.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
      pdf.rect(PAGE_MARGIN, y, contentWidth, headerHeight, "FD");
      setFont(pdf, "bold", 7.2, BRAND_COLOR);
      pdf.text("TIMESTAMP", PAGE_MARGIN + 2, y + 5.2);
      pdf.text("ACTIVITY", PAGE_MARGIN + columnWidths[0] + 2, y + 5.2);
      pdf.text("USER", PAGE_MARGIN + columnWidths[0] + columnWidths[1] + 2, y + 5.2);
      y += headerHeight;
    };

    ensureSpace(headerHeight + rowLineHeight + 2);
    drawTimelineHeader();

    for (const event of events) {
      const timestampLines = pdf.splitTextToSize(formatDateTime(event.createdAt), columnWidths[0] - 4) as string[];
      const actionLines = pdf.splitTextToSize(event.action, columnWidths[1] - 4) as string[];
      const userLines = hasValue(event.user)
        ? pdf.splitTextToSize(event.user, columnWidths[2] - 4) as string[]
        : [];
      let lineIndex = 0;
      const lineCount = Math.max(1, timestampLines.length, actionLines.length, userLines.length);

      while (lineIndex < lineCount) {
        if (ensureSpace(rowLineHeight + 2)) drawTimelineHeader();
        const availableLines = Math.max(1, Math.floor((contentBottom - y - 2) / rowLineHeight));
        const segmentLines = Math.min(lineCount - lineIndex, availableLines);
        const segmentHeight = segmentLines * rowLineHeight + 2;
        const xPositions = [
          PAGE_MARGIN,
          PAGE_MARGIN + columnWidths[0],
          PAGE_MARGIN + columnWidths[0] + columnWidths[1],
        ];

        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        pdf.rect(PAGE_MARGIN, y, contentWidth, segmentHeight, "FD");
        pdf.line(xPositions[1], y, xPositions[1], y + segmentHeight);
        pdf.line(xPositions[2], y, xPositions[2], y + segmentHeight);

        setFont(pdf, "normal", 7.2, MUTED_COLOR);
        for (let offset = 0; offset < segmentLines; offset += 1) {
          const currentIndex = lineIndex + offset;
          const baseline = y + 3.4 + offset * rowLineHeight;
          if (timestampLines[currentIndex]) pdf.text(timestampLines[currentIndex], xPositions[0] + 2, baseline);
          if (actionLines[currentIndex]) {
            setFont(pdf, "normal", 8, TEXT_COLOR);
            pdf.text(actionLines[currentIndex], xPositions[1] + 2, baseline);
            setFont(pdf, "normal", 7.2, MUTED_COLOR);
          }
          if (userLines[currentIndex]) pdf.text(userLines[currentIndex], xPositions[2] + 2, baseline);
        }

        y += segmentHeight;
        lineIndex += segmentLines;
        if (lineIndex < lineCount) {
          addPage();
          drawTimelineHeader();
        }
      }
      y += 1;
    }
  };

  const renderResponsibility = (record: any) => {
    section("Responsibility", 14);
    renderGrid([
      ["Record Owner", ownerName(record)],
      ["Assigned Personnel", hasValue(record.assigned) ? record.assigned : "Not provided"],
      ["Accountable Person", hasValue(record.accountable) ? record.accountable : "Not provided"],
    ], 3, [], 6.2);
  };

  return { section, renderGrid, renderSummaryGroups, renderSharedCard, renderTimeline, renderResponsibility };
}

export async function createRecordReportPdf(
  record: any,
  workLogs: WorkLog[],
  systemEvents: SystemEvent[],
  type: RecordType,
  branding: Branding = {},
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const generatedAt = new Date();
  const logo = await loadLogoData(branding.logoUrl);
  const title = hasValue(branding.title) ? String(branding.title) : DEFAULT_TITLE;
  const startY = drawHeader(pdf, type, record, branding, logo, generatedAt, pageWidth);
  const renderer = createRenderer(pdf, pageWidth, pageHeight, startY);
  const isAssistance = type === "assistance";

  renderer.section("Executive Summary", 28);
  renderer.renderSummaryGroups(recordSummary(type, record));

  renderer.section("Work Execution", 16);
  renderer.renderGrid(workExecution(record), 3, ["Resolution Time"]);

  const detailFields: ReportField[] = isAssistance
    ? [
        ["Issue Reported", record.problem],
        ["Cause", record.cause],
        ["Corrective Action Taken", record.resolution],
        ["Remarks", record.remarks],
      ]
    : [
        ["Task Description", record.description],
        ["Remarks", record.remarks],
      ];
  renderer.renderSharedCard(
    isAssistance ? "Incident Details" : "Task Details",
    detailFields.map(([label, content]) => ({ label, content })),
  );

  const chronologicalWorkLogs = [...workLogs].sort((left, right) =>
    Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id - right.id
  );
  renderer.renderSharedCard("Work Logs", chronologicalWorkLogs.map((entry) => ({
    label: workLogLabels[entry.type],
    content: entry.message,
    signature: entry.createdByName,
  })));

  renderer.renderTimeline(systemEvents, workLogs);
  renderer.renderResponsibility(record);

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    pdf.setLineWidth(0.25);
    pdf.line(PAGE_MARGIN, pageHeight - 20, pageWidth - PAGE_MARGIN, pageHeight - 20);
    setFont(pdf, "normal", 7.2, MUTED_COLOR);
    pdf.text(`Generated by ${title}`, PAGE_MARGIN, pageHeight - 15.5);
    pdf.text(`Reference: ${String(record.refNo)}`, pageWidth - PAGE_MARGIN, pageHeight - 15.5, { align: "right" });
    pdf.text(`Generated: ${formatGeneratedAt(generatedAt)}`, PAGE_MARGIN, pageHeight - 10.5);
    pdf.text(`Page ${page} of {total_pages}`, pageWidth - PAGE_MARGIN, pageHeight - 10.5, { align: "right" });
  }
  pdf.putTotalPages("{total_pages}");

  return { blob: pdf.output("blob") as Blob };
}