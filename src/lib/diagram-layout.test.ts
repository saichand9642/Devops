import { describe, expect, it } from 'vitest'
import {
  DETAIL_LINE,
  FLOW,
  LABEL_LINE,
  NESTED,
  charsFor,
  diagramTextVersion,
  layoutDecision,
  layoutDiagram,
  layoutFlow,
  layoutNested,
  layoutSequence,
  wrapText,
} from './diagram-layout'
import type { DecisionDiagram, FlowDiagram, NestedDiagram, SequenceDiagram } from '../content/types'

describe('wrapText', () => {
  it('keeps a short label on one line', () => {
    expect(wrapText('kube-apiserver', 32)).toEqual(['kube-apiserver'])
  })

  it('breaks on word boundaries', () => {
    expect(wrapText('the scheduler binds the pod to a node', 14)).toEqual([
      'the scheduler',
      'binds the pod',
      'to a node',
    ])
  })

  it('never returns a line longer than the limit', () => {
    const text =
      'kubectl get pods -o jsonpath={.items[*].spec.containers[*].image} --all-namespaces'
    for (const line of wrapText(text, 20)) {
      expect(line.length).toBeLessThanOrEqual(20)
    }
  })

  it('hard-splits a single token that cannot fit', () => {
    // A long image reference must not be allowed to overflow its box.
    expect(wrapText('registry.example.com/team/app:1.2.3', 12)).toEqual([
      'registry.exa',
      'mple.com/tea',
      'm/app:1.2.3',
    ])
  })

  it('lets a following word share the tail of a split token', () => {
    const lines = wrapText('aaaaaaaa bb', 6)
    expect(lines).toEqual(['aaaaaa', 'aa bb'])
  })

  it('returns a single empty line for empty input', () => {
    expect(wrapText('   ', 10)).toEqual([''])
  })
})

describe('charsFor', () => {
  it('subtracts padding from both sides', () => {
    expect(charsFor(100, 10, 10)).toBe(8)
  })

  it('never returns a uselessly small width', () => {
    expect(charsFor(10, 10, 20)).toBe(6)
  })
})

const flow: FlowDiagram = {
  kind: 'flow',
  title: 'Probe outcomes',
  nodes: [
    { label: 'Container starts' },
    { label: 'startupProbe runs', detail: 'liveness and readiness are held back' },
    {
      label: 'readinessProbe passes',
      arrowLabel: 'startup ok',
      branch: { label: 'Pod removed from Endpoints', detail: 'no traffic, not restarted' },
    },
    { label: 'Traffic arrives', tone: 'success' },
  ],
}

describe('layoutFlow', () => {
  it('stacks nodes downward without overlapping', () => {
    const layout = layoutFlow(flow)
    for (let i = 1; i < layout.rows.length; i += 1) {
      const previous = layout.rows[i - 1].node
      const current = layout.rows[i].node
      expect(current.y).toBeGreaterThan(previous.y + previous.h)
    }
  })

  it('reserves a branch column only when a node has a branch', () => {
    expect(layoutFlow(flow).width).toBe(FLOW.boxWidth + FLOW.branchGap + FLOW.branchWidth)
    const noBranch: FlowDiagram = { ...flow, nodes: [{ label: 'One' }, { label: 'Two' }] }
    expect(layoutFlow(noBranch).width).toBe(FLOW.boxWidth)
  })

  it('centres a node and its branch on the same row', () => {
    const row = layoutFlow(flow).rows[2]
    expect(row.branch).toBeDefined()
    const nodeCentre = row.node.y + row.node.h / 2
    const branchCentre = row.branch!.y + row.branch!.h / 2
    expect(Math.abs(nodeCentre - branchCentre)).toBeLessThan(0.01)
  })

  it('defaults a branch to the danger tone', () => {
    expect(layoutFlow(flow).rows[2].branch!.tone).toBe('danger')
  })

  it('ignores an arrow label on the first node, which has no incoming arrow', () => {
    const layout = layoutFlow({
      ...flow,
      nodes: [{ label: 'First', arrowLabel: 'nonsense' }, { label: 'Second' }],
    })
    expect(layout.rows[0].arrowLines).toEqual([])
  })

  it('grows a box to fit its wrapped detail text', () => {
    const layout = layoutFlow(flow)
    const withDetail = layout.rows[1].node
    const withoutDetail = layout.rows[0].node
    expect(withDetail.h).toBeGreaterThan(withoutDetail.h)
    expect(withDetail.detailLines.length).toBeGreaterThan(0)
  })

  it('every box is tall enough for the lines it holds', () => {
    for (const row of layoutFlow(flow).rows) {
      const needed =
        row.node.labelLines.length * LABEL_LINE + row.node.detailLines.length * DETAIL_LINE
      expect(row.node.h).toBeGreaterThan(needed)
    }
  })
})

const sequence: SequenceDiagram = {
  kind: 'sequence',
  title: 'Service traffic',
  participants: [
    { id: 'client', label: 'Client Pod' },
    { id: 'dns', label: 'CoreDNS' },
    { id: 'svc', label: 'Service' },
  ],
  messages: [
    { from: 'client', to: 'dns', label: 'resolve api.prod.svc.cluster.local' },
    { from: 'dns', to: 'client', label: 'ClusterIP', kind: 'return' },
    { from: 'client', to: 'svc', label: 'TCP to ClusterIP:80' },
    { from: 'svc', to: 'svc', label: 'pick a ready endpoint' },
  ],
}

describe('layoutSequence', () => {
  it('gives every participant its own column', () => {
    const layout = layoutSequence(sequence)
    const centres = layout.participants.map((p) => p.centerX)
    expect(new Set(centres).size).toBe(3)
    expect(centres[0]).toBeLessThan(centres[1])
  })

  it('aligns participant boxes on a common baseline', () => {
    const layout = layoutSequence(sequence)
    for (const participant of layout.participants) {
      expect(participant.box.y + participant.box.h).toBe(layout.headerHeight)
    }
  })

  it('orders messages down the page', () => {
    const layout = layoutSequence(sequence)
    for (let i = 1; i < layout.messages.length; i += 1) {
      expect(layout.messages[i].y).toBeGreaterThan(layout.messages[i - 1].y)
    }
  })

  it('marks return messages as dashed', () => {
    expect(layoutSequence(sequence).messages[1].dashed).toBe(true)
    expect(layoutSequence(sequence).messages[0].dashed).toBe(false)
  })

  it('flags a self-message so it can be drawn as a loop', () => {
    expect(layoutSequence(sequence).messages[3].self).toBe(true)
  })

  it('keeps all messages inside the canvas', () => {
    const layout = layoutSequence(sequence)
    for (const message of layout.messages) {
      expect(message.y).toBeLessThan(layout.height)
      expect(message.y).toBeGreaterThan(layout.headerHeight)
    }
  })

  it('falls back to the first column for an unknown participant id', () => {
    const layout = layoutSequence({
      ...sequence,
      messages: [{ from: 'ghost', to: 'dns', label: 'typo in the content' }],
    })
    expect(Number.isFinite(layout.messages[0].fromX)).toBe(true)
  })
})

const nested: NestedDiagram = {
  kind: 'nested',
  title: 'Owner chain',
  root: {
    label: 'Deployment',
    detail: 'declares the desired state',
    children: [
      {
        label: 'ReplicaSet',
        detail: 'one per Pod template revision',
        children: [{ label: 'Pod' }, { label: 'Pod' }],
      },
    ],
  },
}

describe('layoutNested', () => {
  it('places children strictly inside their parent', () => {
    const layout = layoutNested(nested)
    const walk = (node: ReturnType<typeof layoutNested>['root']) => {
      for (const child of node.children) {
        expect(child.x).toBeGreaterThanOrEqual(node.x)
        expect(child.x + child.w).toBeLessThanOrEqual(node.x + node.w)
        expect(child.y).toBeGreaterThan(node.y)
        expect(child.y + child.h).toBeLessThanOrEqual(node.y + node.h + 0.01)
        walk(child)
      }
    }
    walk(layout.root)
  })

  it('narrows each nesting level by the padding', () => {
    const layout = layoutNested(nested)
    const replicaSet = layout.root.children[0]
    expect(replicaSet.w).toBe(NESTED.rootWidth - NESTED.padding * 2)
    expect(replicaSet.depth).toBe(1)
  })

  it('stacks siblings without overlap', () => {
    const layout = layoutNested(nested)
    const [first, second] = layout.root.children[0].children
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.h)
  })

  it('reports a height that contains the whole tree', () => {
    const layout = layoutNested(nested)
    expect(layout.height).toBe(layout.root.h)
    expect(layout.height).toBeGreaterThan(100)
  })
})

const decision: DecisionDiagram = {
  kind: 'decision',
  title: 'Which workload resource?',
  question: 'What does the workload need to do?',
  branches: [
    { condition: 'serve traffic and roll out safely', result: 'Deployment' },
    { condition: 'run once until it succeeds', result: 'Job', detail: 'set backoffLimit' },
    { condition: 'run on a schedule', result: 'CronJob' },
  ],
}

describe('layoutDecision', () => {
  it('puts every branch below the question', () => {
    const layout = layoutDecision(decision)
    for (const branch of layout.branches) {
      expect(branch.box.y).toBeGreaterThanOrEqual(layout.question.h)
    }
  })

  it('indents branches to leave room for the spine', () => {
    for (const branch of layoutDecision(decision).branches) {
      expect(branch.box.x).toBeGreaterThan(layoutDecision(decision).question.x)
    }
  })

  it('runs the spine down to the last connector', () => {
    const layout = layoutDecision(decision)
    const last = layout.branches[layout.branches.length - 1]
    expect(layout.spineBottom).toBe(last.connectorY)
  })

  it('leaves room for the condition line above the result', () => {
    const layout = layoutDecision(decision)
    const withDetail = layout.branches[1].box
    expect(withDetail.detailLines.length).toBeGreaterThan(0)
    expect(layout.branches[0].conditionLines.length).toBeGreaterThan(0)
  })

  it('handles a question with no branches without producing NaN', () => {
    const layout = layoutDecision({ ...decision, branches: [] })
    expect(Number.isFinite(layout.height)).toBe(true)
    expect(layout.spineBottom).toBe(layout.question.h)
  })
})

describe('layoutDiagram', () => {
  it('dispatches on kind', () => {
    expect(layoutDiagram(flow).kind).toBe('flow')
    expect(layoutDiagram(sequence).kind).toBe('sequence')
    expect(layoutDiagram(nested).kind).toBe('nested')
    expect(layoutDiagram(decision).kind).toBe('decision')
  })

  it('always produces positive, finite dimensions', () => {
    for (const diagram of [flow, sequence, nested, decision]) {
      const layout = layoutDiagram(diagram)
      expect(layout.width).toBeGreaterThan(0)
      expect(layout.height).toBeGreaterThan(0)
      expect(Number.isFinite(layout.height)).toBe(true)
    }
  })
})

describe('diagramTextVersion', () => {
  it('numbers the steps of a flow and mentions the side path', () => {
    const lines = diagramTextVersion(flow)
    expect(lines[0]).toMatch(/^Container starts/)
    expect(lines[2]).toContain('Side path: Pod removed from Endpoints')
  })

  it('names participants rather than ids in a sequence', () => {
    const lines = diagramTextVersion(sequence)
    expect(lines[0]).toContain('Client Pod calls CoreDNS')
    expect(lines[1]).toContain('CoreDNS returns to Client Pod')
  })

  it('indents nesting depth', () => {
    const lines = diagramTextVersion(nested)
    expect(lines[0]).toBe('Deployment - declares the desired state')
    expect(lines[1]).toMatch(/^ {2}ReplicaSet/)
    expect(lines[2]).toMatch(/^ {4}Pod$/)
  })

  it('reads a decision as if/then sentences', () => {
    const lines = diagramTextVersion(decision)
    expect(lines[0]).toBe('What does the workload need to do?')
    expect(lines[1]).toBe('If serve traffic and roll out safely: Deployment')
    expect(lines[2]).toContain('If run once until it succeeds: Job - set backoffLimit')
  })

  it('covers every node so the text version is never shorter than the picture', () => {
    expect(diagramTextVersion(flow)).toHaveLength(flow.nodes.length)
    expect(diagramTextVersion(sequence)).toHaveLength(sequence.messages.length)
    expect(diagramTextVersion(decision)).toHaveLength(decision.branches.length + 1)
  })
})
