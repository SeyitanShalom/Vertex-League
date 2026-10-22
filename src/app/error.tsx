"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container page-space">
      <div className="empty-state">
        <p className="eyebrow">LET’S TRY THAT AGAIN</p>
        <h1>This page couldn’t load.</h1>
        <p>
          Your saved registration has not been changed. Please try again in a moment.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
