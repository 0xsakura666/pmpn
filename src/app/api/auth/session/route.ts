import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("tectonic-session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false });
    }

    const sessionData = JSON.parse(
      Buffer.from(sessionToken, "base64").toString("utf-8")
    );

    // Check if session is expired
    if (new Date(sessionData.expiresAt) < new Date()) {
      cookieStore.delete("tectonic-session");
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      address: sessionData.address,
      chainId: sessionData.chainId,
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("tectonic-session");
  return NextResponse.json({ success: true });
}
