"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

export function Dropzone({
  onFiles,
  busy,
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => /\.(csv|tsv|txt)$/i.test(f.name));
    const rejected = Array.from(list).length - files.length;
    if (files.length > 0) onFiles(files);
    if (rejected > 0) {
      window.alert(
        `${rejected} file(s) were skipped. Upload .csv, .tsv or .txt exports — other formats cannot be parsed.`
      );
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files);
      }}
      className={clsx(
        "rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
      )}
    >
      <p className="text-sm font-medium text-slate-900">
        Drag weekly CSV exports here, or browse for them
      </p>
      <p className="mx-auto mt-1 max-w-xl text-xs text-slate-500">
        Several files and several sources can be uploaded at once. UTF-8 and UTF-16 files with
        comma, tab or semicolon separators are all detected automatically.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-4 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Reading files…" : "Browse files"}
      </button>
      <label htmlFor="file-input" className="sr-only">
        Choose CSV files to upload
      </label>
      <input
        id="file-input"
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.tsv,.txt,text/csv"
        className="sr-only"
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
