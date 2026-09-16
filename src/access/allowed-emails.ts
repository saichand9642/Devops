/**
 * The list of people who may open this app.
 *
 * This is the ONLY file you need to edit to give somebody access or take it
 * away. Add their address to the array, redeploy, and they can sign in.
 *
 * Two kinds of entry are understood:
 *
 *   'someone@example.com'  an exact address
 *   '@example.com'         any address on that domain
 *
 * Entries are compared case-insensitively and surrounding spaces are ignored,
 * so 'Someone@Example.com ' and 'someone@example.com' are the same person.
 *
 * IMPORTANT - what this is and is not
 * -----------------------------------
 * The app is a static site with no server, so this list ships inside the
 * JavaScript bundle and anybody who opens developer tools can read it. Treat
 * it as a doorway that keeps the app to the intended study group and keeps
 * each person's progress separate - not as a security control. Do not put
 * anything confidential in here, and do not rely on it to protect content that
 * genuinely must stay private.
 */
export const allowedEmails: readonly string[] = [
  'saichand.kanimeraka@gmail.com',

  // Add teammates below, one per line:
  // 'teammate@tenetic.com',

  // Or open it to a whole domain by uncommenting this:
  // '@tenetic.com',
]
