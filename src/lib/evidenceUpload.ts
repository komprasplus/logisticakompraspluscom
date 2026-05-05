import { supabase } from "@/integrations/supabase/client";

const BUCKET = "evidencias-logistica";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] || "image/jpeg";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Upload a base64/dataURL evidence file to the public bucket and return its public URL.
 */
export async function uploadEvidence(
  pedidoId: number,
  kind: "foto" | "firma" | "llamada",
  dataUrl: string,
): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type.includes("png") ? "png" : "jpg";
  const path = `pedido_${pedidoId}/${kind}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: blob.type,
      upsert: true,
      cacheControl: "3600",
    });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
