import React from "react";
import type { ReactElement } from "react";
import { DreamJournalPDF } from "@/components/pdf/DreamJournalPDF";

type Dream = {
  id: string;
  title: string;
  description: string | null;
  dream_date: string;
  image_url: string | null;
  thumbnail_url: string | null;
};

export function createDreamJournalPDF(
  dreams: Dream[],
  userName: string,
  totalDays: number
): ReactElement {
  return React.createElement(DreamJournalPDF, {
    dreams,
    userName,
    totalDays
  }) as ReactElement;
}

