// Client-side image resize/compress before sending to the API or storing.
// Keeps payloads small (fits well under Vercel's request body limit) while
// staying detailed enough for food-photo recognition.
export function resizeImage(file, maxDim = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('toBlob failed')); return }
            const fr = new FileReader()
            fr.onload = () => {
              const dataUrl = fr.result
              const base64 = String(dataUrl).split(',')[1]
              resolve({ blob, dataUrl, base64, mediaType: 'image/jpeg' })
            }
            fr.onerror = reject
            fr.readAsDataURL(blob)
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
