import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { OperatorGate } from "@/components/OperatorGate";
import { FileText, ShieldCheck, Upload, AlertTriangle, ArrowLeft, FileLock2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments, useUpsertDocument, REQUIRED_DOC_TYPES } from "@/hooks/useDocuments";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/operator/vault")({
  head: () => ({
    meta: [
      { title: "Document Vault — SOLO.drive" },
      { name: "description", content: "Upload and manage your legal credentials. Customers verify before they ride." },
    ],
  }),
  component: () => <OperatorGate><Vault /></OperatorGate>,
});

function Vault() {
  const { user } = useAuth();
  const { data: documents = [], isLoading } = useDocuments();
  const upsert = useUpsertDocument();

  const docMap = Object.fromEntries(documents.map((d) => [d.document_type, d]));

  const handleUpload = async (docTypeId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${docTypeId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, file, { upsert: true });
    if (upErr) {
      console.error(upErr);
      return;
    }
    // The bucket is private — store the path, not a public URL (getPublicUrl()
    // would return a URL that 403s). Generate a signed URL on demand when viewing.
    await upsert.mutateAsync({
      document_type: docTypeId,
      file_url: path,
      status: "pending",
    });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <Link to="/operator" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Document Vault</div>
            <h1 className="mt-1 font-display text-4xl font-semibold">Your credentials, encrypted.</h1>
          </div>
          <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
            <FileLock2 className="h-3.5 w-3.5" /> AES-256 at rest
          </span>
        </div>

        {isLoading ? (
          <div className="mt-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            {REQUIRED_DOC_TYPES.map((dt) => {
              const doc = docMap[dt.id];
              const status = doc?.status ?? "missing";

              return (
                <DocRow
                  key={dt.id}
                  name={dt.name}
                  status={status}
                  onUpload={(file) => handleUpload(dt.id, file)}
                  uploading={upsert.isPending}
                />
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-gradient-surface p-6 text-sm text-muted-foreground">
          Your documents are encrypted and only revealed to a customer after they tap{" "}
          <span className="text-foreground">Verify Driver</span> at booking. You receive a notification each time a document is viewed.
        </div>
      </div>
    </AppShell>
  );
}

function DocRow({
  name,
  status,
  onUpload,
  uploading,
}: {
  name: string;
  status: "verified" | "pending" | "rejected" | "missing";
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const isVerified = status === "verified";
  const isPending = status === "pending";
  const isRejected = status === "rejected";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 shadow-card",
        isVerified ? "border-border bg-card" :
        isPending ? "border-primary/30 bg-primary/5" :
        isRejected ? "border-destructive/40 bg-destructive/5" :
        "border-warning/40 bg-warning/5",
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl",
          isVerified ? "bg-success/15 text-success" :
          isPending ? "bg-primary/15 text-primary-glow" :
          isRejected ? "bg-destructive/15 text-destructive" :
          "bg-warning/15 text-warning",
        )}>
          {isVerified ? (
            <ShieldCheck className="h-5 w-5" />
          ) : isPending ? (
            <FileText className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">
            {isVerified && "Verified"}
            {isPending && "Uploaded · Pending review"}
            {isRejected && "Rejected by Compliance · re-upload required"}
            {status === "missing" && "Required to go online"}
          </div>
        </div>
      </div>

      <button
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm",
          isVerified
            ? "border border-border bg-surface hover:bg-secondary"
            : "bg-gradient-primary text-primary-foreground shadow-glow",
        )}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isVerified ? (
          <><FileText className="h-4 w-4" /> Replace</>
        ) : (
          <><Upload className="h-4 w-4" /> Upload</>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
      />
    </div>
  );
}
