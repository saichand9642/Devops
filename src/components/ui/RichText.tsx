import { Fragment } from 'react'
import type { ReactNode } from 'react'

/**
 * Minimal inline formatter for lesson prose.
 *
 * The content files are plain TypeScript strings, and they use two Markdown
 * conventions that carry real meaning for a technical reader:
 *
 *   `code`     a command, field path or identifier
 *   **bold**   the term being defined, or a warning
 *
 * Nothing else is supported on purpose - this is not a Markdown renderer, and
 * it builds React elements rather than injecting HTML, so content can never
 * introduce markup.
 *
 * Code spans are matched first so that asterisks inside a command are left
 * alone (`kubectl get pods -o jsonpath='{.items[*].metadata.name}'`).
 */

/**
 * One pass, two alternatives: a code span or a bold span. Code is listed
 * first so a command containing asterisks is treated as code
 * (`kubectl get pods -o jsonpath='{.items[*].metadata.name}'`), while bold is
 * non-greedy and formatted recursively so a code span nested inside bold
 * still renders (**Generators with `--dry-run=client -o yaml`**).
 */
const TOKEN = /`([^`]+)`|\*\*([^*]+(?:\*(?!\*)[^*]*)*)\*\*/g

/** Returns the formatted nodes for a string, for use inside another element. */
function formatInline(text: string, depth = 0): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const regex = new RegExp(TOKEN.source, 'g')

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${depth}-${match.index}`
    if (match[1] !== undefined) {
      nodes.push(<code key={`c${key}`}>{match[1]}</code>)
    } else {
      // Recurse so code spans inside bold are still rendered. The depth guard
      // is belt and braces against a pathological string.
      nodes.push(
        <strong key={`b${key}`}>{depth < 4 ? formatInline(match[2], depth + 1) : match[2]}</strong>,
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

/** Inline formatted text, with no wrapper element of its own. */
export function RichText({ text }: { text: string }) {
  return <>{formatInline(text)}</>
}

/** One paragraph per string, each inline-formatted. */
export function RichParagraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((text, index) => (
        <p key={index}>
          <RichText text={text} />
        </p>
      ))}
    </>
  )
}

/** A bulleted list, each item inline-formatted. */
export function RichList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag>
      {items.map((text, index) => (
        <li key={index}>
          <RichText text={text} />
        </li>
      ))}
    </Tag>
  )
}

/**
 * Multi-line prose (an answer or explanation) where blank lines separate
 * paragraphs and single newlines are preserved as line breaks.
 */
export function RichBlock({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/)
  return (
    <>
      {paragraphs.map((paragraph, pIndex) => (
        <p key={pIndex} style={pIndex === paragraphs.length - 1 ? { marginBottom: 0 } : undefined}>
          {paragraph.split('\n').map((line, lIndex, lines) => (
            <Fragment key={lIndex}>
              <RichText text={line} />
              {lIndex < lines.length - 1 && <br />}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  )
}
