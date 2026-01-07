export const downloadBlob = (data: Uint8Array, filename: string) => {
  const blob = new Blob([data], { type: "application/step" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
