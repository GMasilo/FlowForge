export type DocSection = {
  id: string
  title: string
  summary: string
  body: Array<{ heading?: string; paragraphs?: string[]; bullets?: string[]; code?: string }>
  /** Optional detailed function reference (used by the Expressions section). */
  functions?: ExprFunctionDoc[]
}

export type ExprFunctionDoc = {
  name: string
  aliases?: string[]
  signature: string
  description: string
  examples: Array<{ expression: string; result: string; note?: string }>
}

export type FaqItem = {
  id: string
  question: string
  answer: string
}

/** Full expression function reference for documentation. */
export const EXPRESSION_FUNCTIONS: ExprFunctionDoc[] = [
  {
    name: 'parseJson',
    aliases: ['json'],
    signature: 'parseJson(value)',
    description:
      'Parses a JSON string into an object or array. If the value is already an object/array, it is returned as-is. Throws when the string is not valid JSON.',
    examples: [
      {
        expression: '{{parseJson(vars.payload)}}',
        result: '{ "id": 1, "name": "Ada" }',
        note: 'When vars.payload is the string {"id":1,"name":"Ada"}',
      },
      {
        expression: '{{parseJson(vars.payload).name}}',
        result: 'Ada',
        note: 'You can chain property access after parsing',
      },
      {
        expression: '{{json(vars.payload)}}',
        result: '(same as parseJson)',
        note: 'json is an alias',
      },
    ],
  },
  {
    name: 'toJson',
    aliases: ['stringify'],
    signature: 'toJson(value)',
    description:
      'Serializes a value to a JSON string. Strings are returned unchanged (not re-quoted).',
    examples: [
      {
        expression: '{{toJson(vars.user)}}',
        result: '{"id":1,"name":"Ada"}',
        note: 'When vars.user is an object',
      },
      {
        expression: '{{toJson(vars.items)}}',
        result: '[1,2,3]',
      },
    ],
  },
  {
    name: 'string',
    aliases: ['toString'],
    signature: 'string(value)',
    description:
      'Converts any value to text. Objects and arrays become JSON strings; null/undefined become an empty string.',
    examples: [
      {
        expression: '{{string(vars.count)}}',
        result: '42',
        note: 'When vars.count is the number 42',
      },
      {
        expression: '{{string(vars.flags)}}',
        result: '{"active":true}',
        note: 'When vars.flags is an object',
      },
    ],
  },
  {
    name: 'coalesce',
    aliases: ['default'],
    signature: 'coalesce(a, b, …)',
    description:
      'Returns the first argument that is not empty. Empty means null, undefined, "", [], or {}. If every argument is empty, returns the last argument (or null).',
    examples: [
      {
        expression: '{{coalesce(vars.nickname, vars.first_name, "Guest")}}',
        result: 'Ada',
        note: 'When nickname is empty and first_name is "Ada"',
      },
      {
        expression: '{{default(vars.missing, "n/a")}}',
        result: 'n/a',
        note: 'default is an alias of coalesce',
      },
    ],
  },
  {
    name: 'if',
    signature: 'if(condition, whenTrue, whenFalse)',
    description:
      'Returns whenTrue if condition is truthy, otherwise whenFalse. Numbers are truthy unless 0/NaN; non-empty strings/arrays are truthy; null is falsy.',
    examples: [
      {
        expression: '{{if(vars.verified, "Yes", "No")}}',
        result: 'Yes',
        note: 'When vars.verified is true',
      },
      {
        expression: '{{if(empty(vars.email), "missing", vars.email)}}',
        result: 'missing',
        note: 'Combine with empty() for null checks',
      },
    ],
  },
  {
    name: 'empty',
    aliases: ['isBlank'],
    signature: 'empty(value)',
    description:
      'Returns true when the value is null, undefined, "", an empty array, or an object with no keys. Otherwise false.',
    examples: [
      {
        expression: '{{empty(vars.email)}}',
        result: 'true',
        note: 'When vars.email is "" or null',
      },
      {
        expression: '{{empty(vars.items)}}',
        result: 'false',
        note: 'When vars.items is ["a"]',
      },
    ],
  },
  {
    name: 'length',
    aliases: ['len'],
    signature: 'length(value)',
    description:
      'Returns the length of a string or array, or the number of keys on an object. Other values are stringified first.',
    examples: [
      {
        expression: '{{length(vars.name)}}',
        result: '3',
        note: 'When vars.name is "Ada"',
      },
      {
        expression: '{{length(vars.items)}}',
        result: '2',
        note: 'When vars.items is ["a","b"]',
      },
      {
        expression: '{{len(vars.user)}}',
        result: '2',
        note: 'When vars.user is { id, name } — counts keys',
      },
    ],
  },
  {
    name: 'concat',
    signature: 'concat(a, b, …)',
    description: 'Joins all arguments as text with no separator. Non-strings are converted with string().',
    examples: [
      {
        expression: '{{concat(vars.first_name, " ", vars.last_name)}}',
        result: 'Ada Lovelace',
      },
      {
        expression: '{{concat("Order #", vars.order_id)}}',
        result: 'Order #1042',
      },
    ],
  },
  {
    name: 'contains',
    aliases: ['includes'],
    signature: 'contains(haystack, needle)',
    description:
      'For arrays: true if any item string-equals needle. For strings (and other values): true if the text includes needle.',
    examples: [
      {
        expression: '{{contains(vars.email, "@")}}',
        result: 'true',
      },
      {
        expression: '{{contains(vars.tags, "vip")}}',
        result: 'true',
        note: 'When vars.tags is ["new","vip"]',
      },
    ],
  },
  {
    name: 'startsWith',
    signature: 'startsWith(text, prefix)',
    description: 'Returns true when text begins with prefix.',
    examples: [
      {
        expression: '{{startsWith(vars.code, "FF-")}}',
        result: 'true',
        note: 'When vars.code is "FF-1042"',
      },
    ],
  },
  {
    name: 'endsWith',
    signature: 'endsWith(text, suffix)',
    description: 'Returns true when text ends with suffix.',
    examples: [
      {
        expression: '{{endsWith(vars.file, ".pdf")}}',
        result: 'true',
      },
    ],
  },
  {
    name: 'toLower',
    aliases: ['lowercase'],
    signature: 'toLower(value)',
    description: 'Converts the value to lowercase text.',
    examples: [
      {
        expression: '{{toLower(vars.email)}}',
        result: 'ada@example.com',
        note: 'When vars.email is "Ada@Example.com"',
      },
    ],
  },
  {
    name: 'toUpper',
    aliases: ['uppercase'],
    signature: 'toUpper(value)',
    description: 'Converts the value to UPPERCASE text.',
    examples: [
      {
        expression: '{{toUpper(vars.code)}}',
        result: 'ABC',
        note: 'When vars.code is "abc"',
      },
    ],
  },
  {
    name: 'trim',
    signature: 'trim(value)',
    description: 'Removes leading and trailing whitespace from text.',
    examples: [
      {
        expression: '{{trim(vars.name)}}',
        result: 'Ada',
        note: 'When vars.name is "  Ada  "',
      },
    ],
  },
  {
    name: 'slice',
    signature: 'slice(value, start, end?)',
    description:
      'Returns a portion of a string or array. Indexes work like JavaScript slice (end is exclusive; negative indexes count from the end).',
    examples: [
      {
        expression: '{{slice(vars.phone, -4)}}',
        result: '4567',
        note: 'When vars.phone is "+15551234567"',
      },
      {
        expression: '{{slice(vars.items, 0, 2)}}',
        result: '["a","b"]',
        note: 'When vars.items is ["a","b","c"]',
      },
    ],
  },
  {
    name: 'padStart',
    signature: 'padStart(text, length, fill?)',
    description: 'Pads text at the start until it reaches length. fill defaults to a space.',
    examples: [
      {
        expression: '{{padStart(vars.n, 4, "0")}}',
        result: '0042',
        note: 'When vars.n is "42"',
      },
    ],
  },
  {
    name: 'padEnd',
    signature: 'padEnd(text, length, fill?)',
    description: 'Pads text at the end until it reaches length. fill defaults to a space.',
    examples: [
      {
        expression: '{{padEnd(vars.label, 10, ".")}}',
        result: 'Name......',
        note: 'When vars.label is "Name"',
      },
    ],
  },
  {
    name: 'capitalize',
    signature: 'capitalize(text)',
    description: 'Uppercases the first character and leaves the rest unchanged.',
    examples: [
      {
        expression: '{{capitalize(vars.word)}}',
        result: 'Hello',
        note: 'When vars.word is "hello"',
      },
    ],
  },
  {
    name: 'titleCase',
    aliases: ['title'],
    signature: 'titleCase(text)',
    description: 'Converts text to Title Case (first letter of each word capitalized).',
    examples: [
      {
        expression: '{{titleCase(vars.headline)}}',
        result: 'Student Admission Form',
        note: 'When vars.headline is "student admission form"',
      },
    ],
  },
  {
    name: 'slugify',
    aliases: ['slug'],
    signature: 'slugify(text)',
    description: 'Builds a URL-safe slug: lowercase, strips accents, and replaces non-alphanumerics with hyphens.',
    examples: [
      {
        expression: '{{slugify(vars.title)}}',
        result: 'ada-lovelace',
        note: 'When vars.title is "Ada Lovelace!"',
      },
    ],
  },
  {
    name: 'replace',
    signature: 'replace(text, find, with)',
    description:
      'Replaces every occurrence of find in text with with. The third argument defaults to an empty string (delete matches).',
    examples: [
      {
        expression: '{{replace(vars.phone, " ", "")}}',
        result: '+15551234567',
        note: 'When vars.phone is "+1 555 123 4567"',
      },
      {
        expression: '{{replace(vars.label, "draft", "final")}}',
        result: 'final report',
        note: 'When vars.label is "draft report"',
      },
    ],
  },
  {
    name: 'split',
    signature: 'split(text, separator)',
    description: 'Splits text into an array using separator. If separator is omitted, splits into individual characters.',
    examples: [
      {
        expression: '{{split(vars.csv, ",")}}',
        result: '["a","b","c"]',
        note: 'When vars.csv is "a,b,c"',
      },
      {
        expression: '{{first(split(vars.email, "@"))}}',
        result: 'ada',
        note: 'Local part of an email address',
      },
    ],
  },
  {
    name: 'join',
    signature: 'join(array, separator)',
    description:
      'Joins array items into a single string with separator between them. Non-arrays are treated as a one-item list.',
    examples: [
      {
        expression: '{{join(vars.tags, ", ")}}',
        result: 'new, vip',
        note: 'When vars.tags is ["new","vip"]',
      },
      {
        expression: '{{join(vars.parts, "-")}}',
        result: '2026-08-07',
      },
    ],
  },
  {
    name: 'first',
    signature: 'first(array)',
    description: 'Returns the first item of an array. If the value is not an array, returns the value itself.',
    examples: [
      {
        expression: '{{first(vars.items)}}',
        result: 'apple',
        note: 'When vars.items is ["apple","banana"]',
      },
      {
        expression: '{{first(parseJson(vars.payload).items).id}}',
        result: '1',
        note: 'First record id from a parsed JSON list',
      },
    ],
  },
  {
    name: 'last',
    signature: 'last(array)',
    description: 'Returns the last item of an array. If the value is not an array, returns the value itself.',
    examples: [
      {
        expression: '{{last(vars.items)}}',
        result: 'banana',
        note: 'When vars.items is ["apple","banana"]',
      },
    ],
  },
  {
    name: 'at',
    aliases: ['nth'],
    signature: 'at(arrayOrText, index)',
    description:
      'Returns the item (or character) at index. Negative indexes count from the end (−1 is the last item).',
    examples: [
      {
        expression: '{{at(vars.items, 1)}}',
        result: 'b',
        note: 'When vars.items is ["a","b","c"]',
      },
      {
        expression: '{{at(vars.items, -1)}}',
        result: 'c',
      },
    ],
  },
  {
    name: 'reverse',
    signature: 'reverse(value)',
    description: 'Reverses an array or the characters of a string.',
    examples: [
      {
        expression: '{{reverse(vars.code)}}',
        result: 'cba',
        note: 'When vars.code is "abc"',
      },
      {
        expression: '{{reverse(vars.items)}}',
        result: '["c","b","a"]',
      },
    ],
  },
  {
    name: 'unique',
    signature: 'unique(array)',
    description: 'Returns array items with duplicates removed (first occurrence kept).',
    examples: [
      {
        expression: '{{unique(vars.tags)}}',
        result: '["new","vip"]',
        note: 'When vars.tags is ["new","vip","new"]',
      },
    ],
  },
  {
    name: 'keys',
    signature: 'keys(object)',
    description: 'Returns an object’s own keys as an array. Non-objects yield [].',
    examples: [
      {
        expression: '{{keys(vars.user)}}',
        result: '["id","name"]',
        note: 'When vars.user is { id, name }',
      },
    ],
  },
  {
    name: 'values',
    signature: 'values(object)',
    description: 'Returns an object’s own values as an array. Non-objects yield [].',
    examples: [
      {
        expression: '{{values(vars.user)}}',
        result: '[1,"Ada"]',
      },
    ],
  },
  {
    name: 'int',
    aliases: ['integer'],
    signature: 'int(value)',
    description: 'Parses an integer (base 10). Returns null when parsing fails.',
    examples: [
      {
        expression: '{{int(vars.age)}}',
        result: '21',
        note: 'When vars.age is "21"',
      },
      {
        expression: '{{int("3.9")}}',
        result: '3',
        note: 'Truncates toward zero like parseInt',
      },
      {
        expression: '{{int("abc")}}',
        result: 'null',
      },
    ],
  },
  {
    name: 'float',
    aliases: ['number', 'decimal'],
    signature: 'float(value)',
    description: 'Parses a floating-point number. Returns null when parsing fails.',
    examples: [
      {
        expression: '{{float(vars.price)}}',
        result: '19.99',
        note: 'When vars.price is "19.99"',
      },
      {
        expression: '{{number("1e3")}}',
        result: '1000',
      },
    ],
  },
  {
    name: 'bool',
    aliases: ['boolean'],
    signature: 'bool(value)',
    description:
      'Coerces a value to boolean using truthiness: false for false, 0, NaN, "", [], and null/undefined; true otherwise.',
    examples: [
      {
        expression: '{{bool(vars.flag)}}',
        result: 'true',
        note: 'When vars.flag is "yes" (non-empty string)',
      },
      {
        expression: '{{bool(0)}}',
        result: 'false',
      },
    ],
  },
  {
    name: 'equals',
    aliases: ['equal'],
    signature: 'equals(a, b)',
    description: 'Compares two values as strings. Returns true when String(a) === String(b).',
    examples: [
      {
        expression: '{{equals(vars.status, "open")}}',
        result: 'true',
      },
      {
        expression: '{{equals(vars.count, 5)}}',
        result: 'true',
        note: 'When vars.count is 5 or "5"',
      },
    ],
  },
  {
    name: 'add',
    signature: 'add(a, b)',
    description: 'Adds two numbers. Prefer the + operator when writing inline math.',
    examples: [
      {
        expression: '{{add(vars.count, 1)}}',
        result: '6',
        note: 'When vars.count is 5 — same as {{vars.count + 1}}',
      },
    ],
  },
  {
    name: 'sub',
    aliases: ['subtract'],
    signature: 'sub(a, b)',
    description: 'Subtracts b from a. Same as the - operator.',
    examples: [
      {
        expression: '{{sub(vars.total, vars.discount)}}',
        result: '90',
        note: 'When total is 100 and discount is 10',
      },
    ],
  },
  {
    name: 'mul',
    aliases: ['multiply'],
    signature: 'mul(a, b)',
    description: 'Multiplies two numbers. Same as the * operator.',
    examples: [
      {
        expression: '{{mul(vars.qty, vars.price)}}',
        result: '39.98',
      },
    ],
  },
  {
    name: 'div',
    aliases: ['divide'],
    signature: 'div(a, b)',
    description: 'Divides a by b. Returns null when b is 0. Same as the / operator.',
    examples: [
      {
        expression: '{{div(vars.total, vars.count)}}',
        result: '12.5',
      },
      {
        expression: '{{div(vars.total, 0)}}',
        result: 'null',
      },
    ],
  },
  {
    name: 'mod',
    aliases: ['modulo'],
    signature: 'mod(a, b)',
    description: 'Remainder of a ÷ b. Returns null when b is 0. Same idea as the % operator.',
    examples: [
      {
        expression: '{{mod(vars.n, 2)}}',
        result: '1',
        note: 'When vars.n is 5 — useful for odd/even checks',
      },
    ],
  },
  {
    name: 'round',
    signature: 'round(value, decimals?)',
    description: 'Rounds a number. decimals defaults to 0.',
    examples: [
      {
        expression: '{{round(vars.price, 2)}}',
        result: '19.99',
        note: 'When vars.price is 19.987',
      },
      {
        expression: '{{round(3.5)}}',
        result: '4',
      },
    ],
  },
  {
    name: 'floor',
    signature: 'floor(value)',
    description: 'Rounds down to the nearest integer.',
    examples: [
      {
        expression: '{{floor(vars.score)}}',
        result: '3',
        note: 'When vars.score is 3.9',
      },
    ],
  },
  {
    name: 'ceil',
    signature: 'ceil(value)',
    description: 'Rounds up to the nearest integer.',
    examples: [
      {
        expression: '{{ceil(vars.score)}}',
        result: '4',
        note: 'When vars.score is 3.1',
      },
    ],
  },
  {
    name: 'abs',
    signature: 'abs(value)',
    description: 'Absolute value of a number.',
    examples: [
      {
        expression: '{{abs(vars.delta)}}',
        result: '5',
        note: 'When vars.delta is -5',
      },
    ],
  },
  {
    name: 'min',
    signature: 'min(a, b, …)',
    description: 'Returns the smallest finite number among the arguments.',
    examples: [
      {
        expression: '{{min(vars.a, vars.b, 10)}}',
        result: '3',
        note: 'When vars.a is 3 and vars.b is 8',
      },
    ],
  },
  {
    name: 'max',
    signature: 'max(a, b, …)',
    description: 'Returns the largest finite number among the arguments.',
    examples: [
      {
        expression: '{{max(vars.a, vars.b, 10)}}',
        result: '10',
      },
    ],
  },
  {
    name: 'clamp',
    signature: 'clamp(value, min, max)',
    description: 'Constrains value to the inclusive range [min, max].',
    examples: [
      {
        expression: '{{clamp(vars.pct, 0, 100)}}',
        result: '100',
        note: 'When vars.pct is 140',
      },
    ],
  },
  {
    name: 'utcNow',
    aliases: ['now'],
    signature: 'utcNow()',
    description: 'Returns the current time as a UTC ISO-8601 string (e.g. 2026-08-07T07:15:30.123Z). Takes no arguments.',
    examples: [
      {
        expression: '{{utcNow()}}',
        result: '2026-08-07T07:15:30.123Z',
      },
      {
        expression: '{{now()}}',
        result: '(same as utcNow)',
        note: 'now is an alias',
      },
    ],
  },
  {
    name: 'prettify',
    aliases: ['prettyTime', 'prettyDate', 'preetyfy', 'prettyfy'],
    signature: 'prettify(value, styleOrPattern?)',
    description:
      'Formats a date/time for people. Pass an ISO string, timestamp, or Date. Optional second argument: "datetime" (default), "date", "time", "relative"/"ago", "iso", or a custom date-fns pattern such as "yyyy-MM-dd".',
    examples: [
      {
        expression: '{{prettify(vars.submitted_at)}}',
        result: 'Aug 7, 2026 · 9:35 AM',
        note: 'Default datetime style',
      },
      {
        expression: '{{prettify(vars.submitted_at, "date")}}',
        result: 'Aug 7, 2026',
      },
      {
        expression: '{{prettify(vars.submitted_at, "time")}}',
        result: '9:35 AM',
      },
      {
        expression: '{{prettify(vars.submitted_at, "relative")}}',
        result: '3 minutes ago',
      },
      {
        expression: '{{prettify(utcNow(), "EEEE, MMM d")}}',
        result: 'Friday, Aug 7',
        note: 'Custom format pattern',
      },
    ],
  },
  {
    name: 'formatDate',
    aliases: ['dateFormat'],
    signature: 'formatDate(value, pattern?)',
    description:
      'Formats a date with a date-fns pattern. pattern defaults to "MMM d, yyyy". Prefer prettify for common friendly styles.',
    examples: [
      {
        expression: '{{formatDate(vars.dob, "yyyy-MM-dd")}}',
        result: '1998-04-12',
      },
      {
        expression: '{{formatDate(vars.dob, "MMM d, yyyy")}}',
        result: 'Apr 12, 1998',
      },
    ],
  },
  {
    name: 'dateAdd',
    aliases: ['addDate'],
    signature: 'dateAdd(value, amount, unit?)',
    description:
      'Adds amount of unit to a date and returns an ISO string. unit defaults to "days". Supported units: milliseconds, seconds, minutes, hours, days, weeks, months, years (and short forms like "h", "d").',
    examples: [
      {
        expression: '{{dateAdd(vars.start, 7, "days")}}',
        result: '2026-08-14T00:00:00.000Z',
        note: 'When vars.start is 2026-08-07T00:00:00.000Z',
      },
      {
        expression: '{{dateAdd(utcNow(), -1, "hours")}}',
        result: '(one hour ago, as ISO)',
      },
    ],
  },
  {
    name: 'dateDiff',
    aliases: ['diffDate'],
    signature: 'dateDiff(a, b, unit?)',
    description:
      'Returns a − b in the given unit (default "days"). Supported units: seconds, minutes, hours, days.',
    examples: [
      {
        expression: '{{dateDiff(vars.due, vars.start, "days")}}',
        result: '7',
        note: 'Whole days between start and due',
      },
      {
        expression: '{{dateDiff(utcNow(), vars.created_at, "hours")}}',
        result: '5',
      },
    ],
  },
  {
    name: 'not',
    signature: 'not(value)',
    description: 'Logical negation of a truthy check. You can also write not as an operator: {{not vars.flag}}.',
    examples: [
      {
        expression: '{{not(empty(vars.email))}}',
        result: 'true',
        note: 'True when an email is present',
      },
    ],
  },
  {
    name: 'and',
    signature: 'and(a, b, …)',
    description: 'Returns true if every argument is truthy. Also available as an infix operator: a and b.',
    examples: [
      {
        expression: '{{and(vars.verified, not(empty(vars.email)))}}',
        result: 'true',
      },
      {
        expression: '{{vars.ok and vars.count > 0}}',
        result: 'true',
        note: 'Infix form',
      },
    ],
  },
  {
    name: 'or',
    signature: 'or(a, b, …)',
    description: 'Returns true if any argument is truthy. Also available as an infix operator: a or b.',
    examples: [
      {
        expression: '{{or(vars.is_admin, vars.is_owner)}}',
        result: 'true',
      },
    ],
  },
  {
    name: 'renderFile',
    aliases: ['file'],
    signature: 'renderFile(media.promo_logo_jpg)',
    description:
      'Renders a media file inline in chat (image, video, audio, or a download chip). Pass a media object or a URL. In email/HTTP templates the same expression becomes the file URL. Properties: url, filename, name, mime, type, size, key.',
    examples: [
      {
        expression: '{{renderFile(media.promo_logo_jpg)}}',
        result: '(image preview in chat)',
      },
      {
        expression: '{{renderFile(media.promo_logo_jpg.url)}}',
        result: '(same preview from the URL)',
      },
      {
        expression: '{{media.promo_logo_jpg.filename}}',
        result: 'promo-logo.jpg',
      },
    ],
  },
  {
    name: 'null',
    signature: 'null()',
    description: 'Returns null. Useful as an explicit empty fallback inside coalesce or if.',
    examples: [
      {
        expression: '{{coalesce(vars.optional, null())}}',
        result: 'null',
        note: 'When vars.optional is empty',
      },
    ],
  },
]

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary: 'Create an account, join an organisation, and ship your first chatbot flow.',
    body: [
      {
        paragraphs: [
          'FlowForge is a multi-organisation chatbot builder. Each organisation is a separate client (tenant). You design conversational flows visually, connect them to HTTP and email services, store structured data with entities, and preview conversations before publishing.',
        ],
      },
      {
        heading: 'First steps',
        bullets: [
          'Sign up or sign in, then open or create an organisation.',
          'Create a chatbot from the organisation home.',
          'Open Design to add steps, connect them, and configure prompts/variables.',
          'Use Preview to walk through the conversation, then Publish when ready.',
        ],
      },
    ],
  },
  {
    id: 'instances-roles',
    title: 'Organisations & roles',
    summary: 'Organisations keep clients separate; roles control who can edit or admin.',
    body: [
      {
        paragraphs: [
          'An organisation is a single client account — not a team within a larger company. Chatbots, connections, users, and entities belong to that organisation.',
        ],
      },
      {
        heading: 'Roles',
        bullets: [
          'Owner — full control, including users and destructive actions.',
          'Admin — manage users, connections, and chatbots.',
          'Editor — create and edit flows, data, and most chatbot settings.',
          'Viewer — read-only access to inspect flows and configuration.',
        ],
      },
    ],
  },
  {
    id: 'chatbots',
    title: 'Chatbots',
    summary: 'Each chatbot has Settings, Design, and Data.',
    body: [
      {
        bullets: [
          'Settings — name, metadata, and chatbot-level options.',
          'Design — the flow designer (linear and canvas views), preview, and publish.',
          'Data — entities and records your flows can read or write.',
        ],
      },
      {
        paragraphs: [
          'You can import and export flow JSON to copy a design between chatbots or share a sample.',
        ],
      },
    ],
  },
  {
    id: 'designer',
    title: 'Flow designer',
    summary: 'Build steps, wire branches, validate problems, and publish.',
    body: [
      {
        paragraphs: [
          'The designer supports a hybrid experience: a linear sequence for straightforward paths and a canvas for branching logic. Changes autosave as you work. The Problems panel highlights missing references and configuration issues before you publish.',
        ],
      },
      {
        heading: 'Step types',
        bullets: [
          'Message — send text to the user (supports templates and attached media).',
          'Question — collect an answer into a variable, with typed validation. Can attach media to the prompt.',
          'HTTP — call a configured HTTP connection.',
          'Email — send mail through an email connection.',
          'Condition — branch on comparisons (equals, contains, exists, …).',
          'For each — loop over a collection.',
          'Set variable — assign a typed value.',
          'Operation — transform values (math, case, JSON path, replace, …).',
          'Entity — list/get/create/update/delete entity records. Create/update values are checked against each column type (string, number, boolean, date, array, object).',
          'End — finish the conversation, optionally with a closing message and media.',
        ],
      },
      {
        heading: 'Step settings',
        bullets: [
          'Delay — wait before the step runs in preview.',
          'Timeout — for optional questions and some connection steps.',
          'Run after — gate a step on whether the previous step succeeded, failed, skipped, or timed out.',
        ],
      },
      {
        heading: 'Smart suggestions',
        bullets: [
          'Question prompts — as you type, FlowForge infers the expected answer type and attributes (variable name, choices, min/max, file kind, …). High-confidence matches apply automatically while the type is still Text; otherwise tap a chip to apply.',
          'Next steps — the + menu (linear view) and canvas palette rank likely follow-ups from the previous steps. After a name question it offers Ask email; after Yes/No it offers a condition; after Shop it offers payment with {{vars.cart.total}} already wired (product subtotal plus catalog fees).',
          'Suggestions never overwrite a type or variable you already set. Undo still reverses an applied suggestion.',
        ],
      },
    ],
  },
  {
    id: 'media',
    title: 'Media library',
    summary: 'Upload files for a chatbot and attach or reference them on steps.',
    body: [
      {
        paragraphs: [
          'Each chatbot has a Media library on the Design page. Uploads are stored per instance and chatbot. Attach files on Message, Question, and End steps so they appear with that prompt in Preview and published chat. Images, video, and audio play inline; other files show as download links.',
        ],
      },
      {
        heading: 'Attach vs insert',
        bullets: [
          'Attached media — pick files on the step. They always show with that step’s message, even if the text does not mention them.',
          'Preview in chat — insert {{renderFile(media.welcome_png)}} (or pick it from the template helper). Images, video, and audio play inline.',
          'File URL — {{media.welcome_png.url}} (also .filename, .mime, .type, .size) for email, HTTP, or when you need the link as text.',
        ],
      },
      {
        heading: 'Keys',
        paragraphs: [
          'The template key is the filename with the extension joined by an underscore: welcome.png becomes welcome_png. Each file is an object: url, filename, name, mime, type (image|video|audio|file), size, and key.',
        ],
        code: '{{renderFile(media.welcome_png)}}\nLogo URL: {{media.welcome_png.url}}',
      },
      {
        heading: 'Conversation uploads',
        paragraphs: [
          'File upload and Signature answers are stored separately from the media library, at api/files/{instanceId}/{chatbotId}/conversations/{sessionId}_{stepKey}.ext. The answer variable is a file object (url, filename, originalName, mime, size) so later steps can use {{vars.receipt.url}} or {{renderFile(vars.receipt)}}.',
        ],
      },
    ],
  },
  {
    id: 'questions',
    title: 'Questions & validation',
    summary: 'Ask for structured answers with type-specific rules, including shop checkout.',
    body: [
      {
        paragraphs: [
          'Question steps have an expected answer type. Answers can be required or optional. Optional questions may also time out. The prompt is used to suggest a type and attributes (variable name, choices, bounds) — tap a chip to apply, or let a high-confidence match apply while the type is still Text.',
        ],
      },
      {
        heading: 'Answer types',
        bullets: [
          'Text, long text, name',
          'Number, stepper, slider, percentage, currency',
          'Rating, stars, NPS, Likert, mood, thumbs',
          'Yes/No, confirm, choice, gender',
          'Email, phone, OTP/PIN, URL, color',
          'Address, postal code, country',
          'Date, time, date & time',
          'File upload, signature, image choice',
          'Ranking, autocomplete, appointment, matrix',
          'Location, national ID, password, voice note',
          'Payment, captcha, form, shop',
        ],
      },
      {
        heading: 'Validation attributes',
        bullets: [
          'Numeric scales — min, max, step (plus optional end labels)',
          'Currency — ISO currency code (e.g. ZAR, USD)',
          'OTP — digit length (4–12); optional email connection to send/verify {{otp.code}}',
          'Confirm — custom checkbox label',
          'Date / time — earliest and latest bounds',
          'Text-like — min/max length and optional regex pattern',
          'Phone — country code + digits (E.164) or any format',
          'Email — optional allowed-domain list',
          'Choice / gender / Likert — options list; choice/gender support multi-select',
          'File upload — allowed kinds (any / image / document / PDF) and max files; stored under api/files/{instance}/{chatbot}/conversations',
          'Signature — drawn PNG stored in the same conversation folder',
          'Image choice — picture cards from the Media library as a snapping gallery or a grid; stored as { label, filename, url, key } (or an array of those when multi-select)',
          'Ranking — reorder a list; stored as an ordered array',
          'Autocomplete — searchable list (same options source as Choice)',
          'Appointment — calendar date plus a time picker (optional earliest/latest date bounds)',
          'Matrix — one scale applied to several rows; stored as { row: rating }',
          'Location — browser GPS (lat/lng) plus optional label',
          'National ID — South African 13-digit checksum, or digits with min/max length',
          'Password — masked in chat; value still saved on the output variable',
          'Voice note — short recording stored in the conversation files folder',
          'Payment — attach a Payment connection so PHP confirms PayFast ITN (or a custom notify). Without a connection, the visitor self-confirms. Stored as { status, reference, amount, currency }',
          'Captcha — built-in math or distorted text (no reCAPTCHA). Solution is never saved; the answer is { ok: true }',
          'Form — several fields on one screen (name, email, phone, …) stored as a single object',
          'Shop — browse a store catalog, add items to a cart, then checkout. Stored as { items, subtotal, fees, feesTotal, total, currency, itemCount }',
        ],
      },
      {
        heading: 'Shop checkout',
        paragraphs: [
          'Set Response to Shop and pick a Store catalog on the question (created on the Templates tab). Visitors browse categories, add products, and checkout. Each product card keeps Add to cart visible; the catalog grid scrolls if it is taller than the chat panel.',
        ],
        bullets: [
          'subtotal is product lines only. fees / feesTotal are catalog extras. total is what to charge.',
          'Catalog fees can be a fixed amount (shipping, delivery) or a percent of the product subtotal (tax). They apply only when the cart has items.',
          'Follow Shop with a Payment step and set the amount to {{vars.cart.total}} — not subtotal. Smart next-step suggestions wire this for you.',
          'Do not insert a store catalog into a Payment (or other non-Shop) prompt. Insert Template hides catalogs there so cart copy cannot loop back into checkout; Problems warns if a prompt already references one.',
        ],
      },
      {
        paragraphs: [
          'Invalid answers stay on the question in Preview and show an error until the user provides a valid response (or skips, if optional).',
        ],
      },
    ],
  },
  {
    id: 'variables-templates',
    title: 'Variables & templates',
    summary: 'Pass data between steps with {{vars…}}, {{steps…}}, {{media…}}, and {{templates…}}.',
    body: [
      {
        paragraphs: [
          'Global variables are defined per chatbot and seeded into Preview. Step outputs can also write variables. Use template fields anywhere you see the insert helper.',
        ],
      },
      {
        heading: 'References',
        bullets: [
          '{{vars.name}} — a variable value',
          '{{steps.step_key.response}} — a previous question answer',
          '{{steps.http_1.data}} — data from an HTTP step (shape depends on the response)',
          '{{media.welcome_png.url}} — public URL of a chatbot media file',
          '{{renderFile(media.welcome_png)}} — inline image/file preview in chat',
          '{{templates.help_faq.text}} — rendered FAQ / menu / hours / legal text (inputs filled from the step)',
          '{{templates.welcome_email.html}} — HTML email body from a template',
          '{{templates.agreement.file}} — download chip for a filled PDF, Word, or Excel file',
          '{{vars.cart.total}} — payable total from a Shop question (subtotal plus catalog fees)',
          '{{vars.cart.subtotal}} / {{vars.cart.feesTotal}} — product lines only, and fees only',
        ],
      },
      {
        paragraphs: [
          'Copy templates declare named inputs ({{inputs.name}} in the body). Bind those inputs on the Message, Question, End, Email, or OTP step that inserts the template — a variable, a step output, or a literal. Leftover {{vars.name}} placeholders still interpolate. If a required input has no binding, or a leftover variable is not set before the step, Problems flags that step.',
        ],
      },
      {
        heading: 'Example',
        code: 'Hello {{vars.first_name}}, your ticket is {{steps.create_ticket.id}}.',
      },
      {
        paragraphs: [
          'Variable types include string, number, boolean, date, array, and object.',
        ],
      },
    ],
  },
  {
    id: 'expressions',
    title: 'Expressions',
    summary: 'Functions and operators you can use inside {{ }} for transforms and logic.',
    functions: EXPRESSION_FUNCTIONS,
    body: [
      {
        paragraphs: [
          'Anywhere a template field accepts {{ }}, you can write an expression: read variables and step outputs, call functions, and use operators. The designer autocomplete lists the common helpers; this page documents each one with examples.',
        ],
      },
      {
        heading: 'Syntax basics',
        bullets: [
          'Wrap expressions in double braces: {{ … }}.',
          'Read values with vars.name or steps.step_key.field (dot paths and [0] indexes work after objects/arrays).',
          'String literals use single or double quotes: "Ada" or \'Ada\'.',
          'Booleans and null: true, false, null.',
          'Function names are case-insensitive (parseJson and parsejson both work).',
        ],
      },
      {
        heading: 'Operators',
        bullets: [
          'Arithmetic: +  -  *  /  %   →  {{vars.count + 1}}',
          'Comparison: ==  !=  <  >  <=  >=   →  {{vars.age >= 18}}',
          'Logic: and  or  not   →  {{vars.ok and not empty(vars.email)}}',
          'Ternary: condition ? whenTrue : whenFalse   →  {{vars.vip ? "priority" : "standard"}}',
        ],
      },
      {
        heading: 'Quick examples',
        code: 'Hello {{concat(vars.first_name, " ", vars.last_name)}}!\n{{if(empty(vars.email), "No email on file", vars.email)}}\n{{parseJson(vars.payload).items[0].name}}\nSubmitted {{prettify(utcNow(), "relative")}}\nDue {{prettify(dateAdd(utcNow(), 7, "days"), "date")}}',
      },
      {
        heading: 'Function reference',
        paragraphs: [
          'Each function below shows its signature, what it does, and concrete examples with expected results. Aliases are listed when available.',
        ],
      },
    ],
  },
  {
    id: 'preview-publish',
    title: 'Preview & publish',
    summary: 'Test the conversation, then publish a frozen graph.',
    body: [
      {
        bullets: [
          'Preview runs the flow in an in-app chat widget with typing delays, optional skips, timeouts, and live variables. Pick a test scenario (Data tab) to seed fixture globals; when the run finishes, the Run panel shows pass/fail for expected variables and step keys.',
          'Connection steps (HTTP, email, entity) execute against your configured backends during preview when available.',
          'Preview and published chat hide scrollbars on the message list, shop catalog, image-choice gallery, and similar panels so the widget stays uncluttered. Those areas still scroll.',
          'Publish stores the current graph so runtime consumers can use a stable version of the flow.',
        ],
      },
    ],
  },
  {
    id: 'connections',
    title: 'Connections',
    summary: 'Reusable HTTP, email, and payment integrations for your organisation.',
    body: [
      {
        paragraphs: [
          'Connections are defined at the organisation level. Bind a chatbot’s HTTP or email steps, or a Payment question, to a connection. Credentials stay in connection secrets and are only used on the server.',
        ],
      },
      {
        bullets: [
          'HTTP — methods, paths, parameters, and response schema hints for autocomplete.',
          'Email — send templated messages through a configured email connection.',
          'Payment — PayFast merchant ID/key/passphrase, or a custom notify shared secret. The API confirms charges at /payment/notify; chat polls /payment/status.',
          'Visibility may include personal connections and shared ForgeHub-style catalogs depending on your deployment.',
        ],
      },
    ],
  },
  {
    id: 'entities',
    title: 'Entities & data',
    summary: 'Store structured records your flows can query and update.',
    body: [
      {
        paragraphs: [
          'Open a chatbot’s Data tab to define entities (static or dynamic), attributes, and records. Entity steps in the designer can list, get, create, update, or delete records, optionally filtering by attribute.',
        ],
      },
      {
        bullets: [
          'Use output variables to capture entity results for later steps.',
          'Keep attribute keys stable — flows and filters reference them by key.',
        ],
      },
    ],
  },
  {
    id: 'templates',
    title: 'Templates',
    summary: 'Reusable HTML email, FAQ, store catalogs, and other copy — inserted only where the step and response type allow.',
    body: [
      {
        paragraphs: [
          'Open a chatbot’s Templates tab to create reusable content. Copy-style templates (email, FAQ, message, menu, hours, legal, receipt, downloadable file) declare typed inputs; the body uses {{inputs.key}}. Insert the template on a step with {{templates.key.text}} (chat), {{templates.key.html}} / {{templates.key.subject}} (email), or {{templates.key.file}} (download). On that step, bind each input to {{vars.*}}, {{steps.*}}, or a literal. Store catalogs stay as they are. Publishing snapshots templates into the live graph so public chat keeps working even if you edit later.',
        ],
      },
      {
        heading: 'Kinds',
        bullets: [
          'HTML email — subject and HTML body for Email steps and OTP messages.',
          'Help / FAQ — question and answer lists for support menus.',
          'Store catalog — categories, products, and optional checkout fees (shipping, delivery, tax) for a Shop question.',
          'Downloadable file — PDF, Word, or Excel filled from template inputs (and leftover {{vars.*}}). List layout stacks fields; Page layout is an A4 canvas. Insert {{templates.key.file}} on a Message or End step; visitors download the built file.',
          'Menu, chat message, opening hours, legal copy, and receipts.',
        ],
      },
      {
        heading: 'Inputs',
        paragraphs: [
          'On the Templates tab, add named inputs (string, number, boolean, date, or file). Use {{inputs.key}} in the body instead of pasting chatbot variables. When you insert the template on a Message, Question, End, Email, or OTP step, the inspector lists each input so you can bind {{vars.name}}, {{steps.ask_email.response}}, or a typed literal. Required inputs with an empty binding show up in Problems.',
        ],
      },
      {
        heading: 'Match the response type',
        paragraphs: [
          'On a Question, Insert Template and {{ suggestions only list kinds that fit the current Response. Message and End steps can insert chat copy, receipts, and downloadable files.',
        ],
        bullets: [
          'Shop — store catalogs plus chat copy (FAQ, menu, hours, legal). Bind the catalog with Store catalog on the question; do not paste the same catalog into a later Payment prompt.',
          'Payment — chat copy and receipts. Store catalogs are hidden so cart copy cannot loop back into checkout.',
          'Email / OTP questions — FAQ and message copy. Pick HTML email on the Email step or OTP template picker, not in the chat prompt.',
          'Other questions — chat copy and receipts; not catalogs or HTML email.',
        ],
      },
      {
        heading: 'Store catalog fees',
        paragraphs: [
          'On the catalog, add fees as a fixed amount or a percent of the product subtotal. Fees apply only when the cart has items. Charge {{vars.cart.total}} on Payment (subtotal plus fees).',
        ],
      },
      {
        heading: 'Stock',
        paragraphs: [
          'Each product can have an optional stock count. Empty means unlimited. At 0 the shop disables add-to-cart; quantities cannot exceed remaining stock. This number lives in the catalog JSON — it is not a concurrent inventory service, so overlapping chats can still oversell. A later orders table can decrement for real.',
        ],
      },
      {
        heading: 'Receipts',
        paragraphs: [
          'A receipt template’s {{templates.receipt.text}} (or .html) is filled at send time with cart line items, totals, and the payment reference, then remaining {{vars.*}} in the title, intro, and footer are interpolated. Insert it on a Message step or as the Email body after Payment. The designer’s “Send receipt” suggestion uses that pattern.',
        ],
      },
      {
        heading: 'Downloadable files',
        paragraphs: [
          'Create a Downloadable file template and choose PDF, Word, or Excel. Declare inputs such as name, email, and signature, then use {{inputs.name}} in fields and {{inputs.signature}} on an Image field. Bind those inputs on the Message or End step that inserts {{templates.agreement.file}} — visitors get a download chip; the file is built from that conversation when they click it.',
        ],
        bullets: [
          'List layout — stacked title, intro, fields, body, and footer. Use this for a simple form-style file.',
          'Page layout — A4 canvas. Add heading, text, field, signature, line, and cart blocks, then drag them into place.',
          'Snap to grid is on by default (2% of the page). Blocks also snap to each other and to the page center; teal guides appear while you drag. Hold Alt to move freely.',
          'Select a block to set millimetre Left, Top, Width, and Height (lines use Thickness, down to 0.1 mm). Values keep the decimals you type. You can still drag or pull the teal corner.',
          'Font is Helvetica, Times, or Courier, plus size, bold, and left/center/right alignment. Set text color (line color on a Line block) and an optional fill.',
          'PDF keeps positions, fonts, colors, and bold. Word keeps font, color, bold, and reading order, but not pixel placement. Excel is a row list in visual order.',
          'Include shop cart line items when a cart variable is set, or drop a Cart block on the page.',
        ],
      },
      {
        heading: 'Example',
        code: '{{templates.welcome_email.html}}\n{{templates.receipt.text}}\n{{templates.agreement.file}}\n{{vars.cart.total}}',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    summary: 'Drop-off, payment conversion, and top products from public chats.',
    body: [
      {
        paragraphs: [
          'Open Analytics in the organisation to see how far sessions reach (step.run events), how many shop carts convert to a paid intent, and which products appear in completed session variables. Filter by chatbot when several flows share the organisation. Conversation completed/failed webhooks include those same session variables.',
        ],
      },
    ],
  },
  {
    id: 'members',
    title: 'Users',
    summary: 'Invite users and assign roles on the organisation.',
    body: [
      {
        paragraphs: [
          'Owners and admins can open Users to invite people and change roles. Viewers see the roster but cannot change access.',
        ],
      },
    ],
  },
]

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'what-is-flowforge',
    question: 'What is FlowForge?',
    answer:
      'FlowForge is a multi-organisation chatbot builder. Organisations design conversational flows with questions, conditions, HTTP/email integrations, entities, and typed variables — then preview and publish.',
  },
  {
    id: 'instance-vs-chatbot',
    question: 'What is the difference between an organisation and a chatbot?',
    answer:
      'An organisation is a client account (tenant) with its own users, connections, and chatbots. A chatbot is one conversational product inside that organisation, with its own settings, flow design, and data.',
  },
  {
    id: 'who-can-edit',
    question: 'Who can edit flows?',
    answer:
      'Owners, admins, and editors can change designs and most chatbot settings. Viewers can inspect but not modify. Access is managed on the Users page.',
  },
  {
    id: 'conversation-replay',
    question: 'How do I replay a public conversation?',
    answer:
      'Open Conversations in the organisation. Filter by chatbot or status, then click a session to replay the transcript, inspect step runs, export JSON, and view the variables saved at the end of the chat. Sessions still marked active after a day are shown as abandoned. Conversation completed/failed webhooks include those variables.',
  },
  {
    id: 'analytics',
    question: 'Where can I see drop-off and payment conversion?',
    answer:
      'Open Analytics next to Conversations. Filter by chatbot to see how many sessions reached each step, how many shop carts converted to a paid intent, and which products appear in completed session variables.',
  },
  {
    id: 'autosave-publish',
    question: 'Do I need to save before previewing?',
    answer:
      'The designer autosaves as you edit. Preview uses your current draft. Publish creates a published graph snapshot for a stable runtime version.',
  },
  {
    id: 'smart-suggestions',
    question: 'How do smart suggestions work in the designer?',
    answer:
      'On a question, the prompt is analysed for the likely answer type and attributes (email, phone, choices listed in the text, min/max, and a variable name). High-confidence matches apply while the type is still Text; otherwise use the chips under the prompt. The + menu and canvas palette also suggest the next step from what already ran — for example Ask email after a name, a condition after Yes/No, or payment after a shop cart with {{vars.cart.total}} already filled in.',
  },
  {
    id: 'optional-questions',
    question: 'How do optional questions and timeouts work?',
    answer:
      'Set Response to Optional on a question step. Users can skip in Preview. You can also set a Timeout under Settings; when it elapses, the step is marked Timed out so the next step can run after that outcome.',
  },
  {
    id: 'multi-choice',
    question: 'Can users pick more than one choice?',
    answer:
      'Yes. For Choice, Gender, or Image choice, set Selection to Multiple selection. Optionally set min/max selections. Preview shows a Confirm/Send button after selections.',
  },
  {
    id: 'template-syntax',
    question: 'How do I insert a previous answer into a message?',
    answer:
      'Use {{vars.userAnswer}} or {{steps.ask_name.response}} in chat and email steps, depending on where you stored the value. Copy templates use {{inputs.key}} in the body; bind those inputs on the inserting step. Template fields offer suggestions as you type. After a Shop question, use {{vars.cart.total}} (or {{vars.cart.subtotal}} / {{vars.cart.feesTotal}}) on later steps.',
  },
  {
    id: 'shop-cart',
    question: 'How do shop carts and checkout fees work?',
    answer:
      'Set Response to Shop and pick a Store catalog. Visitors browse products, add them to a cart, and checkout. Optional product stock lives on the catalog (empty = unlimited); sold-out items cannot be added and quantities cannot exceed remaining stock. That count is catalog JSON, not a live inventory service. Checkout lists the product subtotal, each catalog fee, then the total. Fees are defined on the catalog as a fixed amount (shipping, delivery) or a percent of that subtotal (tax), and they apply only when the cart has items. Charge {{vars.cart.total}} on the following Payment step. After payment, insert {{templates.receipt.text}} (or .html in Email) so line items, totals, and the payment reference fill in automatically.',
  },
  {
    id: 'insert-template-kinds',
    question: 'Why can’t I insert a store catalog on a Payment question?',
    answer:
      'On a question, Insert Template and {{ suggestions only list templates that match the Response type. Store catalogs belong on Shop. Payment can insert chat copy and receipts. HTML email is picked on Email steps and OTP fields, not in a chat prompt. Message and End steps can insert a downloadable file as {{templates.key.file}}. Message and Email steps after Payment can insert a receipt as {{templates.key.text}} or {{templates.key.html}}. Problems warns if a non-Shop prompt already references a catalog — inserting one there can loop cart copy back into checkout.',
  },
  {
    id: 'media-attach',
    question: 'How do I show an image or file in a chatbot message?',
    answer:
      'Open Design, upload the file in the Media library, then attach it on a Message, Question, or End step — or insert {{renderFile(media.filename_ext)}} in the message text to show a preview (welcome.png becomes {{renderFile(media.welcome_png)}}). Use {{media.welcome_png.url}} when you need the link itself.',
  },
  {
    id: 'document-download',
    question: 'How do I let visitors download a filled PDF, Word, or Excel file?',
    answer:
      'On Templates, create a Downloadable file (PDF, Word, or Excel). Declare inputs on the template ({{inputs.name}}, {{inputs.signature}} for a drawn signature) and bind them on the Message or End step that inserts {{templates.your_key.file}}. Use List layout for a stacked form, or Page layout to place blocks on an A4 page: drag to move, type millimetres for Left/Top/Width/Height (any decimals; lines down to 0.1 mm), snap to the grid (hold Alt to move freely), then set font, bold, and colors. PDF matches the page; Word and Excel follow the same order. Visitors get a download chip; the file is filled when they click it.',
  },
  {
    id: 'http-fail',
    question: 'What happens if an HTTP request fails?',
    answer:
      'The step is marked Failed. Downstream steps can use Run after → has failed to continue on that path, or stay gated on success only (the default).',
  },
  {
    id: 'entities-when',
    question: 'When should I use entities instead of variables?',
    answer:
      'Variables are for values during a single conversation run. Entities persist structured records (customers, tickets, applications) that flows can look up or update across runs.',
  },
  {
    id: 'import-export',
    question: 'Can I copy a flow to another chatbot?',
    answer:
      'Yes. Export the flow as JSON from the designer/chatbot tools, then import it into another chatbot. Review connection IDs and entity references after import — they may need remapping.',
  },
  {
    id: 'mobile',
    question: 'Does the designer work on mobile?',
    answer:
      'You can review and make light edits on smaller screens, but the canvas and inspector are designed primarily for desktop. Prefer a laptop or desktop for complex flows.',
  },
  {
    id: 'get-help',
    question: 'Where do I go if I’m stuck?',
    answer:
      'Start with the Help page for guided tasks, skim Documentation for deeper topics, then check this FAQ. If something looks like a product bug, note the step type, browser, and what you expected vs. what happened.',
  },
]

export const HELP_TOPICS = [
  {
    title: 'Create your first flow',
    description: 'Add a chatbot, open Design, drop a Message and Question, then Preview.',
    to: '/docs#getting-started',
  },
  {
    title: 'Collect a validated answer',
    description: 'Pick an answer type (email, phone, choice…) and set min/max or pattern rules.',
    to: '/docs#questions',
  },
  {
    title: 'Add a shop and take payment',
    description: 'Use a Shop question with a store catalog, optional checkout fees, then charge {{vars.cart.total}} on Payment.',
    to: '/docs#questions',
  },
  {
    title: 'Reuse templates in steps',
    description: 'Create FAQ, email, and catalog templates. On a question, Insert Template only offers kinds that match the Response type.',
    to: '/docs#templates',
  },
  {
    title: 'Use expression functions',
    description: 'Transform values with parseJson, if, coalesce, concat, and more — with examples.',
    to: '/docs#expressions',
  },
  {
    title: 'Attach media to a step',
    description: 'Upload files in the Design page Media library, then attach them on Message, Question, or End steps.',
    to: '/docs#media',
  },
  {
    title: 'Call an API from a step',
    description: 'Create an HTTP connection, bind it on an HTTP step, map params, and Preview.',
    to: '/docs#connections',
  },
  {
    title: 'Branch on success or failure',
    description: 'Use Conditions and Run after settings to continue after failed or timed-out steps.',
    to: '/docs#designer',
  },
  {
    title: 'Store lasting data',
    description: 'Define entities under Data, then use Entity steps to create or look up records.',
    to: '/docs#entities',
  },
  {
    title: 'Invite organisation users',
    description: 'Open Users on your organisation and assign owner, admin, editor, or viewer.',
    to: '/docs#members',
  },
] as const
