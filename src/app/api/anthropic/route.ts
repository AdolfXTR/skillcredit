import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    // Debug: log if key exists (never log the actual key)
    console.log("API key present:", !!apiKey);
    console.log("API key prefix:", apiKey?.slice(0, 10));

    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set in environment variables" },
        { status: 500 }
      );
    }

    const body = await req.json();
    console.log("Calling Anthropic with model:", body.model);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log("Anthropic response status:", res.status);

    if (!res.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return NextResponse.json({ error: data }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("API route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}