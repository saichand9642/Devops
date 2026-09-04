import type { CommandExample } from '../../content/types'
import { CodeBlock } from './CodeBlock'
import { RichText } from './RichText'

/**
 * Renders commands with the three things a beginner needs and tutorials
 * usually omit: what it does, what you should see, and which namespace it
 * touches.
 */
export function CommandList({ commands }: { commands: CommandExample[] }) {
  return (
    <div>
      {commands.map((command) => (
        <div className="command-item" key={command.command}>
          <CodeBlock code={command.command} language="bash" bare />
          <p className="command-item__meta">
            <strong>What it does:</strong> <RichText text={command.what} />
          </p>
          {command.expected && (
            <p className="command-item__meta">
              <strong>Expected result:</strong> <RichText text={command.expected} />
            </p>
          )}
          {command.namespaceNote && (
            <p className="command-item__meta">
              <strong>Namespace:</strong> <RichText text={command.namespaceNote} />
            </p>
          )}
          {command.placeholders && command.placeholders.length > 0 && (
            <p className="command-item__meta">
              <strong>Replace:</strong>{' '}
              {command.placeholders.map((placeholder, index) => (
                <span key={placeholder}>
                  {index > 0 && ', '}
                  <code>{placeholder}</code>
                </span>
              ))}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
