import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DiagramFigure, DiagramList } from './Diagram'
import type { Diagram } from '../../content/types'

const flow: Diagram = {
  kind: 'flow',
  title: 'Rolling update',
  caption: 'maxUnavailable governs how far capacity may dip.',
  nodes: [
    { label: 'New ReplicaSet created' },
    { label: 'Surge Pod becomes Ready', arrowLabel: 'maxSurge' },
    {
      label: 'Old Pod terminated',
      branch: { label: 'Readiness never passes', detail: 'rollout stalls' },
    },
  ],
}

const sequence: Diagram = {
  kind: 'sequence',
  title: 'DNS lookup',
  participants: [
    { id: 'pod', label: 'Pod' },
    { id: 'dns', label: 'CoreDNS' },
  ],
  messages: [
    { from: 'pod', to: 'dns', label: 'A record for api' },
    { from: 'dns', to: 'pod', label: 'ClusterIP', kind: 'return' },
  ],
}

const nested: Diagram = {
  kind: 'nested',
  title: 'Owner chain',
  root: { label: 'Deployment', children: [{ label: 'ReplicaSet' }] },
}

const decision: Diagram = {
  kind: 'decision',
  title: 'Which Service type?',
  question: 'Who needs to reach this workload?',
  branches: [{ condition: 'only other Pods', result: 'ClusterIP' }],
}

describe('DiagramFigure', () => {
  it('labels the diagram with its kind and title', () => {
    render(<DiagramFigure diagram={flow} />)
    expect(screen.getByText('Rolling update')).toBeInTheDocument()
    expect(screen.getByText('Flow')).toBeInTheDocument()
  })

  it('shows the caption so the picture always states its point', () => {
    render(<DiagramFigure diagram={flow} />)
    expect(screen.getByText('maxUnavailable governs how far capacity may dip.')).toBeInTheDocument()
  })

  it('offers a text version of every diagram', () => {
    render(<DiagramFigure diagram={flow} />)
    const details = screen.getByText('Text version').closest('details')
    expect(details).not.toBeNull()
    const items = within(details as HTMLElement).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[2].textContent).toContain('Side path: Readiness never passes')
  })

  it('hides the SVG from assistive tech, since the text version carries it', () => {
    const { container } = render(<DiagramFigure diagram={flow} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders every flow label as SVG text', () => {
    const { container } = render(<DiagramFigure diagram={flow} />)
    const text = Array.from(container.querySelectorAll('svg text')).map((node) => node.textContent)
    expect(text).toContain('New ReplicaSet created')
    expect(text).toContain('maxSurge')
    expect(text).toContain('rollout stalls')
  })

  it('draws one lifeline per sequence participant', () => {
    const { container } = render(<DiagramFigure diagram={sequence} />)
    expect(container.querySelectorAll('.dg-lifeline')).toHaveLength(2)
    expect(container.querySelectorAll('.dg-line--dashed')).toHaveLength(1)
  })

  it('nests boxes for a containment diagram', () => {
    const { container } = render(<DiagramFigure diagram={nested} />)
    const rects = container.querySelectorAll('rect')
    expect(rects).toHaveLength(2)
    const [outer, inner] = Array.from(rects)
    expect(Number(inner.getAttribute('width'))).toBeLessThan(Number(outer.getAttribute('width')))
  })

  it('prefixes a decision condition with "if" so it reads as a rule', () => {
    const { container } = render(<DiagramFigure diagram={decision} />)
    const text = Array.from(container.querySelectorAll('svg text')).map((node) => node.textContent)
    expect(text).toContain('if only other Pods')
    expect(text).toContain('ClusterIP')
  })

  it('gives each diagram its own arrow marker id', () => {
    const { container } = render(<DiagramList diagrams={[flow, { ...flow, title: 'Second' }]} />)
    const ids = Array.from(container.querySelectorAll('marker')).map((node) =>
      node.getAttribute('id'),
    )
    expect(new Set(ids).size).toBe(ids.length)
    // Fragment references must be valid, so React's ":r0:" ids are sanitised.
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('renders nothing for an empty diagram list', () => {
    const { container } = render(<DiagramList diagrams={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
