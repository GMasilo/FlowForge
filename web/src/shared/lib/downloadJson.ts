function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(filename: string, blob: Blob) {
  triggerDownload(filename, blob)
}

/** Trigger a browser download of a JSON value. */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(filename.endsWith('.json') ? filename : `${filename}.json`, blob)
}

/** Open a file picker and parse JSON. */
export function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) {
        reject(new Error('No file selected'))
        return
      }
      file
        .text()
        .then((text) => {
          try {
            resolve(JSON.parse(text) as unknown)
          } catch {
            reject(new Error('File is not valid JSON'))
          }
        })
        .catch(() => reject(new Error('Could not read file')))
    })
    document.body.appendChild(input)
    input.click()
  })
}
