import type { HLJSApi, Language } from 'highlight.js'

/**
 * A highlight.js language definition for HCL / Terraform.
 *
 * highlight.js does not ship one, and pulling in a second highlighting library
 * for one language would cost far more than the 60 lines here - especially in
 * an app that precaches its whole bundle for offline use.
 *
 * Only the token classes the app's stylesheet already themes are emitted, so
 * HCL is coloured consistently with the YAML and shell samples.
 */
export function hcl(hljs: HLJSApi): Language {
  const INTERPOLATION = {
    className: 'template-variable',
    begin: /\$\{/,
    end: /\}/,
    contains: [
      { className: 'variable', begin: /\b[a-z_][a-z0-9_]*(?:\.[a-z0-9_[\]"*-]+)+/ },
      hljs.NUMBER_MODE,
    ],
  }

  return {
    name: 'HCL',
    aliases: ['terraform', 'tf', 'hcl'],
    case_insensitive: false,
    keywords: {
      keyword:
        'resource variable output module data provider terraform locals moved import removed ' +
        'check run backend cloud required_providers required_version for in if else endif ' +
        'for_each count depends_on lifecycle dynamic provisioner connection',
      literal: 'true false null',
      built_in:
        'length lookup merge concat coalesce compact flatten distinct element keys values ' +
        'setunion setintersection contains join split format formatlist replace regex regexall ' +
        'lower upper title trimspace substr jsonencode jsondecode yamlencode yamldecode ' +
        'templatefile file fileexists cidrsubnet cidrhost toset tolist tomap tonumber tostring ' +
        'try can sensitive nonsensitive timestamp uuid base64encode base64decode abs max min ' +
        'range zipmap one alltrue anytrue sum',
    },
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      /*
       * Heredocs carry user-data scripts and JSON policies. Matched before the
       * quoted-string rule so an embedded quote does not end the block early.
       */
      {
        className: 'string',
        begin: /<<-?\s*([A-Z]+)\b/,
        end: /^\s*[A-Z]+\s*$/,
        contains: [INTERPOLATION],
      },
      {
        className: 'string',
        begin: /"/,
        end: /"/,
        illegal: /\n/,
        contains: [{ begin: /\\./ }, INTERPOLATION],
      },
      /*
       * A block header: the type, then its quoted labels. The labels are left
       * to the string rule, so only the leading identifier is a section.
       */
      {
        className: 'section',
        begin:
          /^\s*\b(resource|data|variable|output|module|provider|terraform|locals|moved|import|removed|check|run)\b/,
        end: /(?=[\s"{])/,
        keywords: { keyword: 'resource data variable output module provider terraform locals' },
      },
      /* An attribute name on the left of an `=`, or a nested block name. */
      {
        className: 'attr',
        begin: /\b[a-z_][a-z0-9_]*(?=\s*=[^=])/,
      },
      /* References such as aws_instance.web.id or var.region. */
      {
        className: 'variable',
        begin: /\b(var|local|module|data|each|count|self|path|terraform)\.[a-z0-9_.[\]"*-]+/,
      },
      hljs.NUMBER_MODE,
      { className: 'operator', begin: /[=?:]|=>|&&|\|\||!=|==|>=|<=/ },
    ],
  }
}
