"use client";

import { use } from "react";
import QuotationEditorPage from "../page";

export default function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <QuotationEditorPage editId={id} />;
}
