/**
 * Reads a picked file as text.
 *
 * `File.text()` is the modern API, but it is missing on older iOS Safari - and
 * this app is explicitly meant to be installed from iPhone Safari - so there
 * is a FileReader fallback. Both paths reject with a readable error rather
 * than a DOM event object.
 */
export async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text()
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('The file could not be read.'))
    reader.readAsText(file)
  })
}
