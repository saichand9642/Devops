import { describe, expect, it } from 'vitest'
import { highlightCode } from './highlight'

/**
 * The HCL mode is hand-written, so these tests pin the tokens the stylesheet
 * actually colours. Without them a refactor could silently produce plain text.
 */
describe('HCL highlighting', () => {
  const sample = `# a comment
terraform {
  required_version = ">= 1.5"
}

variable "region" {
  type    = string
  default = "eu-west-1"
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  count         = 2
  tags = {
    Name = "web-\${count.index}"
  }
}`

  const html = highlightCode(sample, 'hcl')

  it('marks comments', () => {
    expect(html).toContain('hljs-comment')
  })

  it('marks block types as sections', () => {
    expect(html).toContain('hljs-section')
  })

  it('marks quoted labels and values as strings', () => {
    expect(html).toContain('hljs-string')
  })

  it('marks attribute names', () => {
    expect(html).toContain('hljs-attr')
  })

  it('marks references such as var.instance_type', () => {
    expect(html).toContain('hljs-variable')
  })

  it('marks numbers', () => {
    expect(html).toContain('hljs-number')
  })

  it('highlights ${...} interpolation inside a string', () => {
    expect(html).toContain('hljs-template-variable')
  })

  it('escapes HTML so a sample can never inject markup', () => {
    const escaped = highlightCode('name = "<img src=x onerror=alert(1)>"', 'hcl')
    expect(escaped).not.toContain('<img')
    expect(escaped).toContain('&lt;img')
  })

  it('recognises built-in functions', () => {
    const built = highlightCode('locals { names = toset(["a", "b"]) }', 'hcl')
    expect(built).toContain('hljs-built_in')
  })

  it('does not throw on a malformed sample', () => {
    expect(() => highlightCode('resource "unclosed" {', 'hcl')).not.toThrow()
  })
})
