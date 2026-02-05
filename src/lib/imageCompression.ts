 /**
  * Image compression utility for evidence photos
  * Compresses images to under 200kb to optimize bandwidth and storage
  */
 
 const MAX_SIZE_BYTES = 200 * 1024; // 200kb target
 const MAX_DIMENSION = 1200; // Max width/height
 
 interface CompressionResult {
   blob: Blob;
   base64: string;
   originalSize: number;
   compressedSize: number;
   compressionRatio: number;
 }
 
 /**
  * Compress an image file to under 200kb
  * Uses canvas to resize and quality reduction
  */
 export async function compressImage(
   file: File | Blob,
   maxSizeBytes: number = MAX_SIZE_BYTES
 ): Promise<CompressionResult> {
   const originalSize = file.size;
   
   // If already under max size, just convert to base64
   if (originalSize <= maxSizeBytes) {
     const base64 = await blobToBase64(file);
     return {
       blob: file instanceof File ? file : new Blob([file], { type: file.type }),
       base64,
       originalSize,
       compressedSize: originalSize,
       compressionRatio: 1,
     };
   }
 
   // Load image into canvas
   const img = await loadImage(file);
   
   // Calculate dimensions maintaining aspect ratio
   let { width, height } = img;
   const aspectRatio = width / height;
   
   if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
     if (width > height) {
       width = MAX_DIMENSION;
       height = Math.round(width / aspectRatio);
     } else {
       height = MAX_DIMENSION;
       width = Math.round(height * aspectRatio);
     }
   }
 
   // Start with high quality and reduce until under target size
   let quality = 0.9;
   let blob: Blob;
   let attempts = 0;
   const maxAttempts = 10;
 
   do {
     blob = await compressToBlob(img, width, height, quality);
     
     if (blob.size <= maxSizeBytes || attempts >= maxAttempts) {
       break;
     }
     
     // Reduce quality or dimensions
     if (quality > 0.3) {
       quality -= 0.1;
     } else {
       // Further reduce dimensions
       width = Math.round(width * 0.8);
       height = Math.round(height * 0.8);
       quality = 0.8;
     }
     
     attempts++;
   } while (blob.size > maxSizeBytes);
 
   const base64 = await blobToBase64(blob);
 
   return {
     blob,
     base64,
     originalSize,
     compressedSize: blob.size,
     compressionRatio: originalSize / blob.size,
   };
 }
 
 /**
  * Compress an image from a base64 data URL
  */
 export async function compressBase64Image(
   dataUrl: string,
   maxSizeBytes: number = MAX_SIZE_BYTES
 ): Promise<CompressionResult> {
   const blob = await dataUrlToBlob(dataUrl);
   return compressImage(blob, maxSizeBytes);
 }
 
 /**
  * Quick check if compression is needed
  */
 export function needsCompression(file: File | Blob): boolean {
   return file.size > MAX_SIZE_BYTES;
 }
 
 // Helper functions
 function loadImage(file: File | Blob): Promise<HTMLImageElement> {
   return new Promise((resolve, reject) => {
     const img = new Image();
     const url = URL.createObjectURL(file);
     
     img.onload = () => {
       URL.revokeObjectURL(url);
       resolve(img);
     };
     
     img.onerror = () => {
       URL.revokeObjectURL(url);
       reject(new Error("Failed to load image"));
     };
     
     img.src = url;
   });
 }
 
 function compressToBlob(
   img: HTMLImageElement,
   width: number,
   height: number,
   quality: number
 ): Promise<Blob> {
   return new Promise((resolve, reject) => {
     const canvas = document.createElement("canvas");
     canvas.width = width;
     canvas.height = height;
     
     const ctx = canvas.getContext("2d");
     if (!ctx) {
       reject(new Error("Failed to get canvas context"));
       return;
     }
     
     // Use better image rendering
     ctx.imageSmoothingEnabled = true;
     ctx.imageSmoothingQuality = "high";
     ctx.drawImage(img, 0, 0, width, height);
     
     canvas.toBlob(
       (blob) => {
         if (blob) {
           resolve(blob);
         } else {
           reject(new Error("Failed to compress image"));
         }
       },
       "image/jpeg",
       quality
     );
   });
 }
 
 function blobToBase64(blob: Blob): Promise<string> {
   return new Promise((resolve, reject) => {
     const reader = new FileReader();
     reader.onloadend = () => resolve(reader.result as string);
     reader.onerror = reject;
     reader.readAsDataURL(blob);
   });
 }
 
 function dataUrlToBlob(dataUrl: string): Promise<Blob> {
   return fetch(dataUrl).then((res) => res.blob());
 }
 
 /**
  * Format file size for display
  */
 export function formatFileSize(bytes: number): string {
   if (bytes < 1024) return `${bytes} B`;
   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
   return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
 }