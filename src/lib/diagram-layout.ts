/**
 * Pure geometry for the diagram renderer.
 *
 * SVG cannot measure text without a live DOM, and we want diagram layout to be
 * deterministic and unit-testable, so every label is wrapped against a
 * conservative average character width for the two font sizes the renderer
 * uses. Boxes then grow to fit the number of lines. The trade-off is that a
 * box is occasionally a little wider than its text strictly needs; in exchange
 * text never spills outside its box, on any platform, with any font stack.
 */

import type {
  DecisionDiagram,
  Diagram,
  DiagramTone,
  FlowDiagram,
  NestedBox,
  NestedDiagram,
  SequenceDiagram,
} from '../content/types'

/* ------------------------------------------------------------ text metrics */

export const LABEL_SIZE = 13
export const DETAIL_SIZE = 11
export const LABEL_LINE = 17
export const DETAIL_LINE = 14

/*
 * Average advance width per character, per text style.
 *
 * These are not guesses: they were measured in a real browser across 365
 * rendered diagram labels, taking the widest observed value per style and
 * rounding up. Short strings dominated by wide glyphs ("exec: command",
 * "environments") set the maximum, so longer text wraps a little earlier than
 * it strictly needs to - which is the right trade, because a box that is one
 * line taller is fine and text outside its box is not.
 *
 * Measured maxima: label 8.81, detail 6.69, edge label 6.86, condition 7.17.
 */
const LABEL_CHAR = 8.9
const DETAIL_CHAR = 6.9
/* The condition line is rendered bold, so it runs wider than plain detail. */
const CONDITION_CHAR = 7.3

/** How many characters of the given size fit in `width` minus its padding. */
export function charsFor(width: number, charWidth: number, padding: number): number {
  return Math.max(6, Math.floor((width - padding * 2) / charWidth))
}

export const labelChars = (width: number, padding: number) => charsFor(width, LABEL_CHAR, padding)
export const detailChars = (width: number, padding: number) => charsFor(width, DETAIL_CHAR, padding)
export const conditionChars = (width: number, padding: number) =>
  charsFor(width, CONDITION_CHAR, padding)

/**
 * Greedy word wrap. A single token longer than the line (a long flag, an image
 * reference, a JSONPath expression) is hard-split rather than allowed to
 * overflow its box.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let line = ''

  for (const word of words) {
    if (word.length > maxChars) {
      if (line) {
        lines.push(line)
        line = ''
      }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars))
      }
      // Leave the last fragment open so the following word can share the line.
      line = lines.pop() ?? ''
      continue
    }
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length <= maxChars) {
      line = candidate
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/* ------------------------------------------------------------ shared shapes */

export interface Box {
  x: number
  y: number
  w: number
  h: number
  labelLines: string[]
  detailLines: string[]
  tone: DiagramTone
  /** Inner padding, so the renderer can place text without knowing the kind. */
  pad: number
}

/** Height of a box that holds the given wrapped lines. */
function boxHeight(labelLines: string[], detailLines: string[], padding: number): number {
  const label = labelLines.length * LABEL_LINE
  const detail = detailLines.length ? 3 + detailLines.length * DETAIL_LINE : 0
  return padding * 2 + label + detail
}

function makeBox(
  content: { label: string; detail?: string; tone?: DiagramTone },
  x: number,
  y: number,
  w: number,
  padding: number,
): Box {
  const labelLines = wrapText(content.label, labelChars(w, padding))
  const detailLines = content.detail ? wrapText(content.detail, detailChars(w, padding)) : []
  return {
    x,
    y,
    w,
    h: boxHeight(labelLines, detailLines, padding),
    labelLines,
    detailLines,
    tone: content.tone ?? 'default',
    pad: padding,
  }
}

/* -------------------------------------------------------------------- flow */

export const FLOW = {
  boxWidth: 244,
  branchWidth: 198,
  branchGap: 44,
  padding: 12,
  /** Vertical room between rows; the arrow and its label live here. */
  gap: 46,
  arrowLabelChars: 18,
}

export interface FlowRow {
  node: Box
  branch?: Box
  /** Label for the arrow entering this node, already wrapped. */
  arrowLines: string[]
}

export interface FlowLayout {
  kind: 'flow'
  width: number
  height: number
  rows: FlowRow[]
}

export function layoutFlow(diagram: FlowDiagram): FlowLayout {
  const hasBranch = diagram.nodes.some((node) => node.branch)
  const width = hasBranch ? FLOW.boxWidth + FLOW.branchGap + FLOW.branchWidth : FLOW.boxWidth
  const branchX = FLOW.boxWidth + FLOW.branchGap

  const rows: FlowRow[] = []
  let y = 0

  diagram.nodes.forEach((node, index) => {
    const box = makeBox(node, 0, 0, FLOW.boxWidth, FLOW.padding)
    const branch = node.branch
      ? makeBox(
          { ...node.branch, tone: node.branch.tone ?? 'danger' },
          branchX,
          0,
          FLOW.branchWidth,
          FLOW.padding,
        )
      : undefined

    const rowHeight = Math.max(box.h, branch?.h ?? 0)
    box.y = y + (rowHeight - box.h) / 2
    if (branch) branch.y = y + (rowHeight - branch.h) / 2

    rows.push({
      node: box,
      branch,
      // The first node has nothing pointing at it, so its arrow label is moot.
      arrowLines:
        index > 0 && node.arrowLabel
          ? wrapText(node.arrowLabel, FLOW.arrowLabelChars).slice(0, 2)
          : [],
    })

    y += rowHeight
    if (index < diagram.nodes.length - 1) y += FLOW.gap
  })

  return { kind: 'flow', width, height: y, rows }
}

/* ---------------------------------------------------------------- sequence */

export const SEQ = {
  colWidth: 168,
  padding: 9,
  headerGap: 16,
  messagePadding: 11,
  selfSpan: 116,
  bottomPad: 12,
}

export interface SeqParticipantLayout {
  id: string
  box: Box
  /** x of the lifeline this participant owns. */
  centerX: number
}

export interface SeqMessageLayout {
  fromX: number
  toX: number
  y: number
  labelLines: string[]
  labelX: number
  dashed: boolean
  self: boolean
  /** Which way a self-message loop points: +1 right, -1 left. */
  selfDir: 1 | -1
}

export interface SequenceLayout {
  kind: 'sequence'
  width: number
  height: number
  headerHeight: number
  participants: SeqParticipantLayout[]
  messages: SeqMessageLayout[]
}

export function layoutSequence(diagram: SequenceDiagram): SequenceLayout {
  const width = Math.max(1, diagram.participants.length) * SEQ.colWidth
  const boxWidth = SEQ.colWidth - 18

  const participants: SeqParticipantLayout[] = diagram.participants.map((participant, index) => {
    const centerX = index * SEQ.colWidth + SEQ.colWidth / 2
    return {
      id: participant.id,
      centerX,
      box: makeBox(
        { label: participant.label, tone: 'accent' },
        centerX - boxWidth / 2,
        0,
        boxWidth,
        SEQ.padding,
      ),
    }
  })

  const headerHeight = participants.reduce((tallest, p) => Math.max(tallest, p.box.h), 0)
  participants.forEach((p) => {
    p.box.y = headerHeight - p.box.h
  })

  const centerOf = (id: string) =>
    participants.find((p) => p.id === id)?.centerX ?? SEQ.colWidth / 2

  const messages: SeqMessageLayout[] = []
  let y = headerHeight + SEQ.headerGap

  for (const message of diagram.messages) {
    const fromX = centerOf(message.from)
    const toX = centerOf(message.to)
    const self = message.from === message.to
    const span = self ? SEQ.selfSpan : Math.abs(toX - fromX)
    const lines = wrapText(message.label, detailChars(span, 8))
    const rowHeight = SEQ.messagePadding + lines.length * DETAIL_LINE + 12

    // A loop on the right-most participant would hang off the canvas, so it
    // points inward instead.
    const selfDir: 1 | -1 = fromX + SEQ.selfSpan + 10 <= width ? 1 : -1
    const rawLabelX = self ? fromX + (selfDir * SEQ.selfSpan) / 2 : (fromX + toX) / 2
    // Centred text is clamped by its own half-width so no label can spill.
    const halfText =
      (lines.reduce((widest, line) => Math.max(widest, line.length), 0) * DETAIL_CHAR) / 2

    messages.push({
      fromX,
      toX,
      y: y + rowHeight - 8,
      labelLines: lines,
      labelX: Math.min(Math.max(rawLabelX, halfText + 2), width - halfText - 2),
      dashed: message.kind === 'return',
      self,
      selfDir,
    })
    y += rowHeight
  }

  return {
    kind: 'sequence',
    width,
    height: y + SEQ.bottomPad,
    headerHeight,
    participants,
    messages,
  }
}

/* ------------------------------------------------------------------ nested */

export const NESTED = { rootWidth: 286, padding: 12, gap: 8 }

export interface NestedNodeLayout extends Box {
  depth: number
  children: NestedNodeLayout[]
}

export interface NestedLayout {
  kind: 'nested'
  width: number
  height: number
  root: NestedNodeLayout
}

function layoutNestedBox(
  source: NestedBox,
  x: number,
  y: number,
  width: number,
  depth: number,
): NestedNodeLayout {
  const base = makeBox(source, x, y, width, NESTED.padding)
  const headerHeight =
    NESTED.padding +
    base.labelLines.length * LABEL_LINE +
    (base.detailLines.length ? 3 + base.detailLines.length * DETAIL_LINE : 0)

  const children: NestedNodeLayout[] = []
  const childWidth = width - NESTED.padding * 2
  let cursor = y + headerHeight + (source.children?.length ? NESTED.gap : 0)

  for (const child of source.children ?? []) {
    const laidOut = layoutNestedBox(child, x + NESTED.padding, cursor, childWidth, depth + 1)
    children.push(laidOut)
    cursor = laidOut.y + laidOut.h + NESTED.gap
  }

  const contentBottom = children.length ? cursor - NESTED.gap : y + headerHeight
  return {
    ...base,
    h: contentBottom + NESTED.padding - y,
    depth,
    children,
  }
}

export function layoutNested(diagram: NestedDiagram): NestedLayout {
  const root = layoutNestedBox(diagram.root, 0, 0, NESTED.rootWidth, 0)
  return { kind: 'nested', width: NESTED.rootWidth, height: root.h, root }
}

/* ---------------------------------------------------------------- decision */

export const DECISION = {
  width: 286,
  spineX: 24,
  branchX: 54,
  padding: 12,
  gap: 14,
  questionGap: 18,
}

export interface DecisionBranchLayout {
  box: Box
  conditionLines: string[]
  /** y of the connector coming off the spine. */
  connectorY: number
}

export interface DecisionLayout {
  kind: 'decision'
  width: number
  height: number
  question: Box
  branches: DecisionBranchLayout[]
  spineBottom: number
}

export function layoutDecision(diagram: DecisionDiagram): DecisionLayout {
  const question = makeBox(
    { label: diagram.question, tone: 'accent' },
    0,
    0,
    DECISION.width,
    DECISION.padding,
  )

  const branchWidth = DECISION.width - DECISION.branchX
  const branches: DecisionBranchLayout[] = []
  let y = question.h + DECISION.questionGap

  for (const branch of diagram.branches) {
    /*
     * The rendered text is "if <condition>", so the prefix must be part of
     * what gets wrapped. Wrapping the bare condition and adding "if " at draw
     * time made the first line three characters too long, pushing it outside
     * the viewBox.
     */
    const conditionLines = wrapText(
      `if ${branch.condition}`,
      conditionChars(branchWidth, DECISION.padding),
    )
    const box = makeBox(
      { label: branch.result, detail: branch.detail, tone: branch.tone ?? 'success' },
      DECISION.branchX,
      y,
      branchWidth,
      DECISION.padding,
    )
    // The condition sits above the result inside the same box.
    box.h += conditionLines.length * DETAIL_LINE + 4

    branches.push({ box, conditionLines, connectorY: y + box.h / 2 })
    y += box.h + DECISION.gap
  }

  const last = branches[branches.length - 1]
  return {
    kind: 'decision',
    width: DECISION.width,
    height: Math.max(question.h, y - DECISION.gap),
    question,
    branches,
    spineBottom: last ? last.connectorY : question.h,
  }
}

/* ----------------------------------------------------------------- facade */

export type DiagramLayout = FlowLayout | SequenceLayout | NestedLayout | DecisionLayout

export function layoutDiagram(diagram: Diagram): DiagramLayout {
  switch (diagram.kind) {
    case 'flow':
      return layoutFlow(diagram)
    case 'sequence':
      return layoutSequence(diagram)
    case 'nested':
      return layoutNested(diagram)
    case 'decision':
      return layoutDecision(diagram)
  }
}

/**
 * A prose rendering of the same information.
 *
 * Shown in a "Text version" disclosure under every diagram. An SVG full of
 * absolutely positioned <text> nodes is close to useless to a screen reader
 * even with ARIA, and a linear description is also genuinely handy for anyone
 * revising without looking closely at the picture.
 */
export function diagramTextVersion(diagram: Diagram): string[] {
  switch (diagram.kind) {
    case 'flow':
      return diagram.nodes.map((node, index) => {
        const arrow = index > 0 && node.arrowLabel ? ` (${node.arrowLabel})` : ''
        const detail = node.detail ? ` - ${node.detail}` : ''
        const branch = node.branch
          ? ` Side path: ${node.branch.label}${
              node.branch.detail ? ` - ${node.branch.detail}` : ''
            }`
          : ''
        return `${node.label}${detail}${arrow}.${branch}`
      })
    case 'sequence': {
      const nameOf = (id: string) => diagram.participants.find((p) => p.id === id)?.label ?? id
      return diagram.messages.map(
        (message) =>
          `${nameOf(message.from)} ${
            message.kind === 'return' ? 'returns to' : 'calls'
          } ${nameOf(message.to)}: ${message.label}`,
      )
    }
    case 'nested': {
      const lines: string[] = []
      const walk = (box: NestedBox, depth: number) => {
        const indent = '  '.repeat(depth)
        lines.push(`${indent}${box.label}${box.detail ? ` - ${box.detail}` : ''}`)
        for (const child of box.children ?? []) walk(child, depth + 1)
      }
      walk(diagram.root, 0)
      return lines
    }
    case 'decision':
      return [
        diagram.question,
        ...diagram.branches.map(
          (branch) =>
            `If ${branch.condition}: ${branch.result}${branch.detail ? ` - ${branch.detail}` : ''}`,
        ),
      ]
  }
}
