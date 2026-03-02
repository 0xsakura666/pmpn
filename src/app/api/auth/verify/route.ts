import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { message, signature } = await request.json();

    // Parse and verify the SIWE message
    const siweMessage = new SiweMessage(message);
    const { success, data } = await siweMessage.verify({ signature });

    if (!success) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Create session token (in production, use proper JWT)
    const sessionToken = Buffer.from(
      JSON.stringify({
        address: data.address,
        chainId: data.chainId,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    ).toString("base64");

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("tectonic-session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return NextResponse.json({
      success: true,
      address: data.address,
    });
  } catch (error) {
    console.error("Auth verification error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
