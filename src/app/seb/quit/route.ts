import { htmlPage } from "@/lib/launch";

export function GET() {
  return htmlPage("Done", "<h1>All done</h1><p>You can close Safe Exam Browser.</p>");
}
