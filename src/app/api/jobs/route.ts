import { NextResponse } from "next/server";
import { getJobLists } from "@/lib/data/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const data = await getJobLists(fresh);
  return NextResponse.json(data);
}
