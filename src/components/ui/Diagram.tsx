/**
 * Renders a `Diagram` from the content model as inline SVG.
 *
 * Why inline SVG rather than Mermaid or images:
 * - no diagram library to download, so lessons stay usable offline;
 * - colours come from the same CSS custom properties as the rest of the app,
 *   so every diagram is readable in light and dark themes automatically;
 * - the source is typed data, so a bad node reference is a build error.
 *
 * All geometry lives in `src/lib/diagram-layout.ts`; this file only draws.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { Diagram, NestedBox } from '../../content/types'
import {
  DECISION,
  DETAIL_LINE,
  FLOW,
  LABEL_LINE,
  SEQ,
  diagramTextVersion,
  layoutDecision,
  layoutFlow,
  layoutNested,
  layoutSequence,
  type Box,
  type NestedNodeLayout,
} from '../../lib/diagram-layout'

/** First baseline offsets inside a box, measured from the padding edge. */
const LABEL_BASELINE = 12
const DETAIL_BASELINE = 10

interface Markers {
  arrow: string
  danger: string
}

function Defs({ markers }: { markers: Markers }) {
  return (
    <defs>
      <marker
        id={markers.arrow}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="9"
        markerHeight="9"
        markerUnits="userSpaceOnUse"
        orient="auto-start-reverse"
      >
        <path d="M 0.5 1 L 9 5 L 0.5 9 z" className="dg-head" />
      </marker>
      <marker
        id={markers.danger}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="9"
        markerHeight="9"
        markerUnits="userSpaceOnUse"
        orient="auto-start-reverse"
      >
        <path d="M 0.5 1 L 9 5 L 0.5 9 z" className="dg-head dg-head--danger" />
      </marker>
    </defs>
  )
}

function BoxShape({ box, align = 'start' }: { box: Box; align?: 'start' | 'middle' }) {
  const textX = align === 'middle' ? box.x + box.w / 2 : box.x + box.pad
  const labelTop = box.y + box.pad + LABEL_BASELINE
  const detailTop = box.y + box.pad + box.labelLines.length * LABEL_LINE + 3 + DETAIL_BASELINE

  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={9}
        className={`dg-box dg-box--${box.tone}`}
      />
      {box.labelLines.map((line, index) => (
        <text
          key={`l${index}`}
          x={textX}
          y={labelTop + index * LABEL_LINE}
          textAnchor={align}
          className="dg-label"
        >
          {line}
        </text>
      ))}
      {box.detailLines.map((line, index) => (
        <text
          key={`d${index}`}
          x={textX}
          y={detailTop + index * DETAIL_LINE}
          textAnchor={align}
          className="dg-detail"
        >
          {line}
        </text>
      ))}
    </g>
  )
}

/* -------------------------------------------------------------------- flow */

function FlowSvg({ diagram, markers }: { diagram: Diagram; markers: Markers }) {
  if (diagram.kind !== 'flow') return null
  const layout = layoutFlow(diagram)
  const centerX = FLOW.boxWidth / 2

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      className="dg-svg"
      aria-hidden="true"
      focusable="false"
    >
      <Defs markers={markers} />
      {layout.rows.map((row, index) => {
        const previous = layout.rows[index - 1]
        const arrowTop = previous ? previous.node.y + previous.node.h : 0
        return (
          <g key={index}>
            {previous ? (
              <>
                <line
                  x1={centerX}
                  y1={arrowTop + 2}
                  x2={centerX}
                  y2={row.node.y - 3}
                  className="dg-line"
                  markerEnd={`url(#${markers.arrow})`}
                />
                {row.arrowLines.map((line, lineIndex) => (
                  <text
                    key={lineIndex}
                    x={centerX + 10}
                    y={
                      (arrowTop + row.node.y) / 2 -
                      (row.arrowLines.length - 1) * (DETAIL_LINE / 2) +
                      lineIndex * DETAIL_LINE +
                      4
                    }
                    className="dg-edge-label"
                  >
                    {line}
                  </text>
                ))}
              </>
            ) : null}
            <BoxShape box={row.node} />
            {row.branch ? (
              <>
                <line
                  x1={FLOW.boxWidth + 2}
                  y1={row.branch.y + row.branch.h / 2}
                  x2={row.branch.x - 3}
                  y2={row.branch.y + row.branch.h / 2}
                  className="dg-line dg-line--danger"
                  markerEnd={`url(#${markers.danger})`}
                />
                <BoxShape box={row.branch} />
              </>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

/* ---------------------------------------------------------------- sequence */

function SequenceSvg({ diagram, markers }: { diagram: Diagram; markers: Markers }) {
  if (diagram.kind !== 'sequence') return null
  const layout = layoutSequence(diagram)

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      className="dg-svg"
      aria-hidden="true"
      focusable="false"
    >
      <Defs markers={markers} />
      {layout.participants.map((participant) => (
        <line
          key={`life-${participant.id}`}
          x1={participant.centerX}
          y1={layout.headerHeight}
          x2={participant.centerX}
          y2={layout.height - 4}
          className="dg-lifeline"
        />
      ))}
      {layout.participants.map((participant) => (
        <BoxShape key={participant.id} box={participant.box} align="middle" />
      ))}
      {layout.messages.map((message, index) => (
        <g key={index}>
          {message.self ? (
            <path
              d={`M ${message.fromX} ${message.y - 16} h ${
                message.selfDir * SEQ.selfSpan
              } v 16 h ${-message.selfDir * (SEQ.selfSpan - 8)}`}
              className={`dg-line${message.dashed ? ' dg-line--dashed' : ''}`}
              fill="none"
              markerEnd={`url(#${markers.arrow})`}
            />
          ) : (
            <line
              x1={message.fromX + (message.toX > message.fromX ? 3 : -3)}
              y1={message.y}
              x2={message.toX + (message.toX > message.fromX ? -3 : 3)}
              y2={message.y}
              className={`dg-line${message.dashed ? ' dg-line--dashed' : ''}`}
              markerEnd={`url(#${markers.arrow})`}
            />
          )}
          {message.labelLines.map((line, lineIndex) => (
            <text
              key={lineIndex}
              x={message.labelX}
              y={
                message.y -
                8 -
                (message.labelLines.length - 1 - lineIndex) * DETAIL_LINE -
                (message.self ? 16 : 0)
              }
              textAnchor="middle"
              className="dg-edge-label"
            >
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------------ nested */

function NestedNode({ node }: { node: NestedNodeLayout }) {
  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={10}
        className={`dg-box dg-box--${node.tone} dg-box--depth${Math.min(node.depth, 3)}`}
      />
      {node.labelLines.map((line, index) => (
        <text
          key={`l${index}`}
          x={node.x + node.pad}
          y={node.y + node.pad + LABEL_BASELINE + index * LABEL_LINE}
          className="dg-label"
        >
          {line}
        </text>
      ))}
      {node.detailLines.map((line, index) => (
        <text
          key={`d${index}`}
          x={node.x + node.pad}
          y={
            node.y +
            node.pad +
            node.labelLines.length * LABEL_LINE +
            3 +
            DETAIL_BASELINE +
            index * DETAIL_LINE
          }
          className="dg-detail"
        >
          {line}
        </text>
      ))}
      {node.children.map((child, index) => (
        <NestedNode key={index} node={child} />
      ))}
    </g>
  )
}

function NestedSvg({ diagram }: { diagram: Diagram }) {
  if (diagram.kind !== 'nested') return null
  const layout = layoutNested(diagram)
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      className="dg-svg"
      aria-hidden="true"
      focusable="false"
    >
      <NestedNode node={layout.root} />
    </svg>
  )
}

/* ---------------------------------------------------------------- decision */

function DecisionSvg({ diagram, markers }: { diagram: Diagram; markers: Markers }) {
  if (diagram.kind !== 'decision') return null
  const layout = layoutDecision(diagram)

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      className="dg-svg"
      aria-hidden="true"
      focusable="false"
    >
      <Defs markers={markers} />
      <BoxShape box={layout.question} align="middle" />
      <line
        x1={DECISION.spineX}
        y1={layout.question.h}
        x2={DECISION.spineX}
        y2={layout.spineBottom}
        className="dg-line dg-line--spine"
      />
      {layout.branches.map((branch, index) => {
        const box = branch.box
        const conditionTop = box.y + box.pad + DETAIL_BASELINE
        const labelTop =
          box.y + box.pad + branch.conditionLines.length * DETAIL_LINE + 4 + LABEL_BASELINE
        const detailTop =
          labelTop + box.labelLines.length * LABEL_LINE + 3 - LABEL_BASELINE + DETAIL_BASELINE

        return (
          <g key={index}>
            <line
              x1={DECISION.spineX}
              y1={branch.connectorY}
              x2={box.x - 3}
              y2={branch.connectorY}
              className="dg-line"
              markerEnd={`url(#${markers.arrow})`}
            />
            <rect
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              rx={9}
              className={`dg-box dg-box--${box.tone}`}
            />
            {branch.conditionLines.map((line, lineIndex) => (
              <text
                key={`c${lineIndex}`}
                x={box.x + box.pad}
                y={conditionTop + lineIndex * DETAIL_LINE}
                className="dg-condition"
              >
                {line}
              </text>
            ))}
            {box.labelLines.map((line, lineIndex) => (
              <text
                key={`l${lineIndex}`}
                x={box.x + box.pad}
                y={labelTop + lineIndex * LABEL_LINE}
                className="dg-label"
              >
                {line}
              </text>
            ))}
            {box.detailLines.map((line, lineIndex) => (
              <text
                key={`d${lineIndex}`}
                x={box.x + box.pad}
                y={detailTop + lineIndex * DETAIL_LINE}
                className="dg-detail"
              >
                {line}
              </text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/* ----------------------------------------------------------------- facade */

/**
 * Reports whether an element is currently scrollable sideways.
 *
 * Measured rather than inferred from a media query: how much room a diagram
 * gets depends on the sidebar as well as the viewport, so a breakpoint would
 * be wrong on tablets and in split view.
 */
function useHorizontalOverflow() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setOverflows(node.scrollWidth - node.clientWidth > 4)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, overflows }
}

const KIND_LABEL: Record<Diagram['kind'], string> = {
  flow: 'Flow',
  sequence: 'Who calls what',
  nested: 'What contains what',
  decision: 'How to choose',
}

export function DiagramFigure({ diagram }: { diagram: Diagram }) {
  // useId produces ":r3:", which is not a valid fragment identifier for
  // url(#...), so the colons are stripped before the markers are referenced.
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const markers: Markers = { arrow: `${raw}-a`, danger: `${raw}-d` }
  const text = diagramTextVersion(diagram)
  const { ref, overflows } = useHorizontalOverflow()
  const ordered = diagram.kind === 'flow' || diagram.kind === 'sequence'

  const svg =
    diagram.kind === 'flow' ? (
      <FlowSvg diagram={diagram} markers={markers} />
    ) : diagram.kind === 'sequence' ? (
      <SequenceSvg diagram={diagram} markers={markers} />
    ) : diagram.kind === 'nested' ? (
      <NestedSvg diagram={diagram} />
    ) : (
      <DecisionSvg diagram={diagram} markers={markers} />
    )

  return (
    <figure className="diagram">
      <figcaption className="diagram-head">
        <span className="diagram-kind">{KIND_LABEL[diagram.kind]}</span>
        <span className="diagram-title">{diagram.title}</span>
      </figcaption>
      <div className="diagram-canvas" ref={ref}>
        {svg}
      </div>
      {overflows ? (
        <p className="diagram-hint">Swipe the diagram sideways to see the rest.</p>
      ) : null}
      {diagram.caption ? <p className="diagram-caption">{diagram.caption}</p> : null}
      <details className="diagram-alt">
        <summary>Text version</summary>
        {/*
          Numbered only where the order carries meaning. A containment diagram
          or a set of alternatives is not a sequence, and numbering it would
          imply steps that do not exist.
        */}
        {ordered ? (
          <ol className="diagram-alt-list">
            {text.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ol>
        ) : (
          <ul className="diagram-alt-list">
            {text.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        )}
      </details>
    </figure>
  )
}

export function DiagramList({ diagrams }: { diagrams: Diagram[] }) {
  if (diagrams.length === 0) return null
  return (
    <div className="diagram-list">
      {diagrams.map((diagram, index) => (
        <DiagramFigure key={index} diagram={diagram} />
      ))}
    </div>
  )
}

/** Re-exported so content files can be written without importing two modules. */
export type { NestedBox }
