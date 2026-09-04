import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RichBlock, RichList, RichParagraphs, RichText } from './RichText'

describe('RichText', () => {
  it('renders plain text unchanged', () => {
    render(<RichText text="A probe is a periodic check." />)
    expect(screen.getByText('A probe is a periodic check.')).toBeInTheDocument()
  })

  it('renders **bold** as a strong element and drops the markers', () => {
    const { container } = render(<RichText text="the **kubelet** runs it" />)
    const strong = container.querySelector('strong')
    expect(strong).toHaveTextContent('kubelet')
    expect(container.textContent).toBe('the kubelet runs it')
    expect(container.textContent).not.toContain('*')
  })

  it('renders `code` as a code element and drops the backticks', () => {
    const { container } = render(<RichText text="run `kubectl get pods` first" />)
    const code = container.querySelector('code')
    expect(code).toHaveTextContent('kubectl get pods')
    expect(container.textContent).toBe('run kubectl get pods first')
    expect(container.textContent).not.toContain('`')
  })

  it('handles several spans of both kinds in one string', () => {
    const { container } = render(
      <RichText text="**readiness** gates traffic; use `kubectl get endpoints` and **not** `ping`" />,
    )
    expect(container.querySelectorAll('strong')).toHaveLength(2)
    expect(container.querySelectorAll('code')).toHaveLength(2)
    expect(container.textContent).toBe(
      'readiness gates traffic; use kubectl get endpoints and not ping',
    )
  })

  it('leaves asterisks inside a code span alone', () => {
    const { container } = render(
      <RichText text="use `kubectl get pods -o jsonpath='{.items[*].metadata.name}'` here" />,
    )
    expect(container.querySelectorAll('strong')).toHaveLength(0)
    expect(container.querySelector('code')?.textContent).toBe(
      "kubectl get pods -o jsonpath='{.items[*].metadata.name}'",
    )
  })

  it('leaves an unmatched marker as literal text rather than eating content', () => {
    const { container } = render(<RichText text="a ** dangling marker and a ` tick" />)
    expect(container.textContent).toBe('a ** dangling marker and a ` tick')
  })

  it('handles adjacent spans', () => {
    const { container } = render(<RichText text="**a**`b`**c**" />)
    expect(container.textContent).toBe('abc')
    expect(container.querySelectorAll('strong')).toHaveLength(2)
    expect(container.querySelectorAll('code')).toHaveLength(1)
  })

  it('renders a code span nested inside bold', () => {
    const { container } = render(
      <RichText text="**Generators with `--dry-run=client -o yaml`** are the fastest route" />,
    )
    const strong = container.querySelector('strong')
    expect(strong).toBeTruthy()
    expect(strong?.querySelector('code')?.textContent).toBe('--dry-run=client -o yaml')
    expect(container.textContent).toBe(
      'Generators with --dry-run=client -o yaml are the fastest route',
    )
    expect(container.textContent).not.toContain('*')
    expect(container.textContent).not.toContain('`')
  })

  it('handles several bold spans that each contain code', () => {
    const { container } = render(
      <RichText text="use **`kubectl get endpoints`** then **`kubectl describe`** next" />,
    )
    expect(container.querySelectorAll('strong')).toHaveLength(2)
    expect(container.querySelectorAll('strong code')).toHaveLength(2)
    expect(container.textContent).toBe('use kubectl get endpoints then kubectl describe next')
  })

  it('keeps a single asterisk inside bold text', () => {
    const { container } = render(<RichText text="**items[*] matters** here" />)
    expect(container.querySelector('strong')?.textContent).toBe('items[*] matters')
    expect(container.textContent).toBe('items[*] matters here')
  })

  it('does not treat content as markup', () => {
    const { container } = render(<RichText text="a <script>alert(1)</script> b" />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })
})

describe('RichParagraphs', () => {
  it('renders one paragraph per string with formatting applied', () => {
    const { container } = render(
      <RichParagraphs items={['first with **bold**', 'second with `code`']} />,
    )
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelector('strong')).toHaveTextContent('bold')
    expect(container.querySelector('code')).toHaveTextContent('code')
  })
})

describe('RichList', () => {
  it('renders an unordered list by default and an ordered list on request', () => {
    const { container: ul } = render(<RichList items={['a **b**', 'c']} />)
    expect(ul.querySelector('ul')).toBeTruthy()
    expect(ul.querySelectorAll('li')).toHaveLength(2)

    const { container: ol } = render(<RichList items={['step']} ordered />)
    expect(ol.querySelector('ol')).toBeTruthy()
  })
})

describe('RichBlock', () => {
  it('splits blank-line-separated text into paragraphs', () => {
    const { container } = render(<RichBlock text={'first para\n\nsecond para'} />)
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('keeps single newlines as line breaks', () => {
    const { container } = render(<RichBlock text={'line one\nline two'} />)
    expect(container.querySelectorAll('p')).toHaveLength(1)
    expect(container.querySelectorAll('br')).toHaveLength(1)
  })

  it('formats inline spans inside a block', () => {
    const { container } = render(
      <RichBlock text={'run `kubectl apply -f x.yaml`\nthen **verify**'} />,
    )
    expect(container.querySelector('code')).toHaveTextContent('kubectl apply -f x.yaml')
    expect(container.querySelector('strong')).toHaveTextContent('verify')
  })
})
