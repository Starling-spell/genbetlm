import { NextResponse } from "next/server";
import { getWalletSnapshot } from "@/lib/zerion";

export const runtime = "nodejs";

const evmAddress = /^0x[a-fA-F0-9]{40}$/;
const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!evmAddress.test(address) && !solanaAddress.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  try {
    const wallet = await getWalletSnapshot(address);
    return NextResponse.json({ wallet });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load wallet."
      },
      { status: 502 }
    );
  }
}
