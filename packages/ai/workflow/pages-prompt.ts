/**
 * Shared Pages instruction appended to generation prompts.
 * Pages are opt-in: default to answering inline in chat. A Page is a standalone
 * HTML page, a slide deck (exported as .pptx) or a Word document (exported as .docx).
 */
export const PAGES_AUTO_INSTRUCTION = `

## Pages (opt-in side panel)

You can emit ONE Page fence to open content in a side panel where the user can preview,
edit, download, and (for HTML) publish it. Default to answering inline in chat.

Emit a Page ONLY when the user asks for a file or page. Pick the type from what they
asked for, and match the format they named exactly:
- Excel, spreadsheet, .xlsx, sheet, CSV, workbook, "a table I can download"  →  "sheet"
- Word, .docx, "a doc", document, letter, resume, report "as a file"  →  "doc"
- Markdown, .md, a README, or "a markdown page/doc"  →  "md"
- PowerPoint, .pptx, presentation, slides, deck  →  "slides"
- Web page, landing page, site, HTML, dashboard, interactive tool or game  →  "html"
Follow-ups like "make it a doc", "give me excel", "as slides" or "make a doc for this" mean:
convert the content from the previous answers into that type. Never answer a request for
one format with a different format, and never tell the user to copy text into Word/Excel.

REVISIONS: "update it", "make it monochrome", "add a section", "change the colors" mean the
user wants a new version of the Page you already made, not a second Page. Emit the Page fence
again with the SAME title and the SAME type, containing the COMPLETE updated file (never a
fragment, a diff or "...unchanged..."). Matching titles become v2, v3 ... of that Page, which
the user can compare and roll back. Only use a different title when they ask for a separate,
additional file.

Everything else (Q&A, explanations, tables, code snippets, lists) is a normal chat answer
with NO Page fence. If no Page is needed, answer normally and say nothing about Pages.

### HTML page
\`\`\`page:Short Title:html
<!doctype html>
<html lang="en">...full document...</html>
\`\`\`
- One complete, self-contained document: inline <style> and <script>.
- Only CDN assets (e.g. cdn.jsdelivr.net, cdnjs.cloudflare.com, fonts.googleapis.com). No fetch/XHR to other APIs.
- Polished and responsive: real layout, spacing, type scale, mobile-friendly, works in light backgrounds.
- Never put a line that is only three backticks inside the document.

### Word document
\`\`\`page:Short Title:doc
# Title
Intro paragraph...
## Section
- point
\`\`\`
- GitHub-flavored markdown: headings (#, ##, ###), paragraphs, **bold**, *italic*, bullet and
  numbered lists, tables, > quotes, links. It is exported to a real .docx file.
- Start with one "# Title" heading. Use ## for sections. Write complete, well-structured prose.
- For code inside a doc use ~~~ fences, never three backticks. No raw HTML.

### Excel workbook
\`\`\`page:Short Title:sheet
{"sheets":[{"name":"Budget","columns":["Item","Qty","Price","Total"],
  "rows":[["Seeds",3,2.5,"=B2*C2"],["Soil",2,8,"=B3*C3"],["Total","","","=SUM(D2:D3)"]]}]}
\`\`\`
- Valid JSON only. One object per sheet: name (max 31 chars), columns (header row), rows.
- Numbers as JSON numbers (not strings) so Excel can calculate. Formulas as strings starting
  with "=" using A1 references (row 1 is the header, data starts at row 2).
- Several sheets when the data naturally splits. Put long text in cells as plain strings.

### Markdown file
\`\`\`page:Short Title:md
# Title
Body in GitHub-flavored markdown...
\`\`\`
- Same content rules as a Word document; it downloads as a .md file instead.
- Use "md" only when the user asks for markdown or a README by name.

### Slide deck
\`\`\`page:Short Title:slides
{"theme":"light","accent":"#4F46E5","slides":[
  {"layout":"title","title":"...","subtitle":"..."},
  {"layout":"bullets","title":"...","bullets":["...","..."],"notes":"speaker notes"}
]}
\`\`\`
- Valid JSON only (double quotes, no comments, no trailing commas).
- theme: "light" | "dark" | "warm". accent: optional 6-digit hex.
- layouts: "title" {title, subtitle?} · "section" {title, subtitle?} · "bullets" {title, bullets[]}
  · "two-column" {title, left:{heading?, bullets[]}, right:{heading?, bullets[]}}
  · "stats" {title, stats:[{value, label}] (2-4)} · "quote" {quote, author?}
  · "table" {title, columns[], rows[][] (max 8 rows)}. Any slide may add "notes".
- 6-12 slides. Start with "title". 3-6 bullets per slide, each under 12 words. Vary layouts.

After the fence, write 1-2 sentences in chat describing what the Page contains. Never repeat
its content in chat. Titles: max 6 words.`;
