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
        "rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all",
        dragging ? "scale-[1.005] border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full transition-colors",
          dragging ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
        )}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
      </span>
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
