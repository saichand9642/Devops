import { useMemo } from 'react'
import type { CodeLanguage } from '../../content/types'
import { highlightCode } from '../../lib/highlight'
import { CopyButton } from './CopyButton'

interface CodeBlockProps {
  code: string
  language?: CodeLanguage
  title?: string
  explanation?: string
  placeholders?: string[]
  /** Hide the header row for inline single-line commands. */
  bare?: boolean
}

export function CodeBlock({
  code,
  language = 'yaml',
  title,
  explanation,
  placeholders,
  bare = false,
}: CodeBlockProps) {
  const html = useMemo(() => highlightCode(code, language), [code, language])

  return (
    <div className="code-block">
      {!bare && (
        <div className="code-block__header">
          {title ? (
            <span className="code-block__title">{title}</span>
          ) : (
            <span className="code-block__title code-block__lang">{language}</span>
          )}
          {title && <span className="code-block__lang">{language}</span>}
          <CopyButton text={code} />
        </div>
      )}
      <pre className="code-block__pre" tabIndex={0}>
        {/* highlight.js escapes its own output, so this markup is safe. */}
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      {explanation && <p className="code-block__explanation">{explanation}</p>}
      {placeholders && placeholders.length > 0 && (
        <div className="code-block__placeholders">
          <strong>Replace:</strong>
          {placeholders.map((placeholder) => (
            <code key={placeholder}>{placeholder}</code>
          ))}
        </div>
      )}
    </div>
  )
}
