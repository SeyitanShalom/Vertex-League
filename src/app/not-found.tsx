import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="container page-space">
      <div className="empty-state">
        <p className="eyebrow">OFF THE PITCH / 404</p>
        <h1>This page isn’t here.</h1>
        <p>Return to the league or use your saved private registration link.</p>
        <Button asChild>
          <Link href="/">Back to Vertex League</Link>
        </Button>
      </div>
    </div>
  );
}
