export async function comprimirImagem(file, maxLado = 1600, qualidade = 0.7) {
  // Só comprime imagens; se vier algo estranho, devolve o original
  if (!file || !file.type?.startsWith('image/')) return file;

  try {
    const img = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const largura = Math.round(img.width * escala);
    const altura = Math.round(img.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, largura, altura);
    img.close?.();

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', qualidade)
    );

    if (!blob) return file; // fallback: usa o original se algo falhar

    const nome = (file.name || 'nota').replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg' });
  } catch {
    return file; // qualquer erro → não bloqueia o envio
  }
}