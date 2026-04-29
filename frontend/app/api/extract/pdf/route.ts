import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' field." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_BYTES} bytes.` },
      { status: 413 }
    );
  }

  const data = new Uint8Array(await file.arrayBuffer());

  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data });
    const result = await parser.getText();
    const text = (result.text ?? "").trim();
    const truncated = text.length > MAX_TEXT_CHARS;
    const finalText = truncated ? text.slice(0, MAX_TEXT_CHARS) : text;

    return NextResponse.json({
      text: finalText,
      numPages: result.total ?? 0,
      truncated,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF extraction failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  } finally {
    try {
      await parser?.destroy();
    } catch {
      // ignore
    }
  }
}
