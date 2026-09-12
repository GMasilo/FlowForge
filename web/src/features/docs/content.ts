export type DocSection = {
  id: string
  title: string
  summary: string
  body: Array<{
    heading?: string
    paragraphs?: string[]
    bullets?: string[]
    code?: string
    /** Illustration under BASE_URL, e.g. docs/designer.png */
    image?: { src: string; alt: string; caption?: string }
  }>
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
      'Renders a media library file inline in chat (image, video, audio, or a download chip). Pass a media object or a URL. In email/HTTP templates the same expression becomes the file URL. Properties: url, filename, name, mime, type, size, key. For YouTube, X, and other social players, use embed() instead.',
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
    name: 'embed',
    aliases: ['embedMedia'],
    signature: 'embed("https://www.youtube.com/watch?v=…")',
    description:
      'Embed a YouTube, X (Twitter), Vimeo, Spotify, or TikTok URL as an inline player or post in Message and Question text. Pass a quoted https URL or a variable that holds one (for example vars.video_url). Preview and public chat show a sandboxed player in a wider bubble; email and other non-chat contexts receive the plain URL. Unsupported hosts are rejected at runtime. Media library files still use renderFile(); opening-hours and downloadable-file templates use {{templates.key.text}} / {{templates.key.file}}.',
    examples: [
      {
        expression: '{{embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}}',
        result: '(YouTube player in chat)',
      },
      {
        expression: '{{embed("https://youtu.be/dQw4w9WgXcQ")}}',
        result: '(same YouTube player)',
      },
      {
        expression: '{{embed("https://x.com/FlowForge/status/1234567890")}}',
        result: '(X post embed in chat)',
      },
      {
        expression: '{{embed(vars.video_url)}}',
        result: '(player for the URL stored in vars.video_url)',
      },
    ],
  },
  {
    name: 'cookie',
    aliases: ['getCookie'],
    signature: 'cookie(name)',
    description:
      'Reads a FlowForge chat cookie saved for this chatbot in the browser (returning-visitor data). Returns null when missing. Cookies are scoped per chatbot — values set in one bot are not visible in another. Values are stored on the chat origin with a localStorage mirror so they still work in many embed contexts.',
    examples: [
      {
        expression: '{{cookie("email")}}',
        result: 'ada@example.com',
        note: 'When setCookie("email", …) was used on a prior visit',
      },
      {
        expression: '{{coalesce(cookie("name"), "Guest")}}',
        result: 'Guest',
        note: 'When the cookie is not set',
      },
    ],
  },
  {
    name: 'setCookie',
    signature: 'setCookie(name, value, days?)',
    description:
      'Saves a FlowForge chat cookie for later visits to this chatbot only. Optional days defaults to 365; use 0 for a session cookie. Returns the stored value. Prefer Button → Run function → setCookie for side effects; the expression form also works in templates.',
    examples: [
      {
        expression: '{{setCookie("email", vars.email)}}',
        result: 'ada@example.com',
      },
      {
        expression: '{{setCookie("plan", "pro", 30)}}',
        result: 'pro',
        note: 'Expires after 30 days',
      },
    ],
  },
  {
    name: 'clearCookie',
    aliases: ['deleteCookie', 'removeCookie'],
    signature: 'clearCookie(name)',
    description: 'Deletes a FlowForge chat cookie for this chatbot (and its localStorage mirror). Returns null.',
    examples: [
      {
        expression: '{{clearCookie("email")}}',
        result: 'null',
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
          'FlowForge is a multi-organisation chatbot builder. Each organisation is a separate client (tenant). You design conversational flows visually, connect HTTP/email/payment services and Integrations, store structured data with entities, hand off to live agents, transfer between chatbots, and preview before publishing.',
        ],
        image: {
          src: 'docs/chatbots.png',
          alt: 'Organisation Chatbots home with chatbot cards, Import, and New chatbot',
          caption: 'Organisation home — create, open, or import chatbots.',
        },
      },
      {
        heading: 'First steps',
        bullets: [
          'Sign up or sign in, then open or create an organisation.',
          'Create a chatbot from the organisation home. You can start blank or from a starter template (support, leads, appointments, shop, feedback, and more) that seeds common flows, content templates, and data tables.',
          'Open Design to add steps, connect them, and configure prompts/variables. Use Templates for FAQ, catalogs, receipts, and downloadable files.',
          'Use Preview to walk through the conversation, then Publish when ready (optionally to Staging first).',
          'Invite teammates — including Agents for live Inbox support — from Admin → Users.',
          'Configure organisation profile, Connections, and Integrations under the primary nav and Admin menu.',
          'Monitor public chats under Conversations and Analytics; claim handoffs in Inbox; manage quotas, webhooks, and alerts from Admin.',
        ],
      },
    ],
  },
  {
    id: 'instances-roles',
    title: 'Organisations & roles',
    summary: 'Organisations keep clients separate; roles control who can edit, admin, or handle live handoffs.',
    body: [
      {
        paragraphs: [
          'An organisation is a single client account — not a team within a larger company. Chatbots, connections, integrations, users, and entities belong to that organisation.',
        ],
        image: {
          src: 'docs/admin-users.png',
          alt: 'Admin Users page showing member roles',
          caption: 'Roles are assigned per organisation under Admin → Users.',
        },
      },
      {
        heading: 'Roles',
        bullets: [
          'Owner — full control, including users, billing-style settings, and destructive actions.',
          'Admin — manage users, connections, integrations, compliance, security, and chatbots.',
          'Editor — create and edit flows, templates, data, and most chatbot settings.',
          'Agent — live support only: Inbox and Conversations (claim, reply, transfer, resolve). Cannot open Design, Connections, Analytics, Marketplace, or Admin. After sign-in, Agents land on Inbox.',
          'Viewer — read-only access to inspect flows and configuration.',
        ],
      },
      {
        heading: 'What each role sees',
        bullets: [
          'Owners and admins get the Admin menu (Users, Compliance, Security, Integrations, Webhooks, Audit, Usage, Alerts) plus Agent console.',
          'Editors and viewers use the primary nav (Chatbots, Connections, Conversations, Inbox, Analytics, Marketplace) without Admin or Agent console.',
          'Agents only see Inbox and Conversations.',
        ],
      },
    ],
  },
  {
    id: 'chatbots',
    title: 'Chatbots',
    summary: 'Each chatbot has Settings, Design, Templates, and Data.',
    body: [
      {
        bullets: [
          'Settings — name, public chat, transfer variables, and chatbot-level options.',
          'Design — the flow designer (linear and canvas views), preview, and publish.',
          'Templates — reusable email, FAQ, hours, legal, store catalogs, receipts, and downloadable files.',
          'Data — entities, records, and test scenarios your flows can use.',
        ],
        image: {
          src: 'docs/chatbots.png',
          alt: 'Chatbots grid showing status badges and Open designer actions',
          caption: 'Each card links to Design, Settings, and sharing metadata.',
        },
      },
      {
        paragraphs: [
          'When you create a chatbot, pick a starter template to seed a ready flow plus the content packs organisations commonly need (welcome, menu, hours, FAQ, legal, follow-up email). You can also import and export flow JSON to copy a design between chatbots or share a sample. Deleting a chatbot moves it to the Recycle bin. Admins can restore it or delete it forever from there.',
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
          'The designer supports a hybrid experience: a linear sequence for straightforward paths and a canvas for branching logic. Changes autosave as you work. The Problems panel highlights missing references and configuration issues before you publish. Collaborative editing can show presence, step locks, and comments when enabled for the organisation.',
        ],
        image: {
          src: 'docs/designer.png',
          alt: 'Flow designer canvas with steps, inspector, and preview',
          caption: 'Designer — canvas or linear view, inspector, and live preview.',
        },
      },
      {
        heading: 'Step types',
        bullets: [
          'Message — send text to the user. Supports **bold**, *italic*, ~~strike~~, `code`, [links](https://…), {color:name}coloured text{/color}, and {{embed("https://…")}} for YouTube / X / Vimeo / Spotify / TikTok (see Message formatting). Templates and attached media also work.',
          'Button — show action buttons under an optional message. Each button has listeners: pick an event (Click, Hover, Double-click, Focus, Blur) and an action (Continue flow, Emit event, Run function, Skip to step). Run function lists setVar / setCookie / clearCookie plus every expression helper (cookie, toUpper, coalesce, …). Under Settings → Run after, use “When skipped, go to step” to jump ahead when the previous step’s outcome is not selected.',
          'Skip to step — jump to another step by key (same target as Button → Skip to step). Empty target continues on the next edge.',
          'Question — collect an answer into a variable, with typed validation. Prompt text supports the same formatting and social embeds as Message. Can attach media to the prompt.',
          'HTTP request — call a configured HTTP connection.',
          'Database — run parameterized SQL against a Database connection (PostgreSQL, MySQL, SQL Server, or SQLite). Bind values with :name placeholders; results land in the output variable as { rows, rowCount }.',
          'Send email — send mail through an email connection.',
          'Integration — run an organisation Integration (OneDrive, Drive, Slack, Sheets, S3, …): pick the integration, action, and fields; optional output variable. Separate from HTTP Connections.',
          'Handoff — escalate the live conversation to the Agent Inbox. Pick a queue from Agent console; routing skills and auto-assign apply when matching agents are online and under their concurrency limit.',
          'Transfer chatbot — move the live conversation to another active chatbot in the same organisation. Choose the start step (not an End step) and map variables (target globals and step output variables). Enable Return to previous chatbot to send the visitor back using {{vars._transferred_from}}. Mark Transfer variables under Chatbot settings → Global variables on the receiving bot. The target entry step only sees explicitly mapped inputs (or pass-all), plus its own globals.',
          'Sign in — collect identity mid-flow. Sources: HTTP verify against a connection (map request field names or a JSON body with {{email}} / {{password}}), Entity lookup (match email + password attributes on an entity record — use attribute type password so values are hashed at rest with PBKDF2), password (optional HTTP), OTP email (email first → send code → verify), SSO (select an SSO / IdP template created under Templates — OIDC or SAML IdP settings, button label, and claim mapping live on the template), or Sign out (clears session variables and {{vars._signed_in}}). Skip if already signed in (default on) continues on Success when {{vars._signed_in}} is set. Incorrect HTTP/entity/OTP credentials stay on the step and show remaining attempts (Max attempts, default 5), then take the Fail edge. Success / Fail edges branch the flow; response paths (User id path, Token path, Profile path) map HTTP response fields into variables (defaults: {{vars.user_id}}, {{vars.auth_token}}, {{vars.user}}, {{vars.email}}, {{vars._signed_in}}). Entity mode stores the matched record as the profile (password omitted). SSO maps IdP claims into the same variables; designer preview simulates success with the template’s Preview email. Rename variables on the inspector. Access nested profile data with {{vars.user.email}}, {{vars.user.name}}, etc. Step output: {{steps.sign_in_1.ok}}, {{steps.sign_in_1.profile}}, etc.',
          'Condition — branch on comparisons (equals, contains, exists, …).',
          'Switch — match a value against multiple cases (plus Default).',
          'For each — loop over a collection.',
          'Set variable — assign one or more typed values in a single step (rows run top to bottom).',
          'Operation — transform values (math, case, JSON path, replace, …).',
          'Entity — query/get/create/update/delete entity records (owned or installed on this chatbot). Query supports no-code filters (AND/OR with equals, contains, comparisons). Create auto-generates the primary key `id` when left blank. Actions respect the install’s CRUD flags.',
          'End — finish the conversation, optionally with a closing message and media.',
        ],
      },
      {
        heading: 'Step settings',
        bullets: [
          'On run — silent expressions evaluated when the step runs (setCookie, setVar, …). Results are not shown in chat.',
          'Delay — wait before the step runs in preview.',
          'Timeout — for optional questions and some connection steps.',
          'Run after — gate a step on whether the previous step succeeded, failed, skipped, or timed out. Optionally set “When skipped, go to step” to jump to another step instead of continuing to the next edge.',
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
          'Each chatbot has a Media library on the Design page. Uploads are stored per instance and chatbot. Attach files on Message, Question, and End steps so they appear with that prompt in Preview and published chat. Images, video, and audio play inline; PDFs show View and Download; other documents show Download.',
        ],
      },
      {
        heading: 'Open and download',
        bullets: [
          'In chat — PDFs attached to a step (or {{renderFile(media.key)}}) offer View and Download. Filled Downloadable file templates ({{templates.key.file}}) do the same for PDF.',
          'In the Media panel — Open and Download for library files.',
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
          'Yes/No, confirm, choice, numbered choice, gender',
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
          'Numbered choice — show 1. Red / 2. Blue; reply with 2 (or tap) to select Blue; stored as the label',
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
    id: 'message-formatting',
    title: 'Message formatting',
    summary: 'Style bot text, embed YouTube or X posts, and show hours or file cards in chat.',
    body: [
      {
        paragraphs: [
          'Message and Question prompts support lightweight styling marks, social video embeds, and rich template cards. Marks nest freely and work in Preview, public chat, and the website widget. The step inspector lists the syntax under Message text / Prompt.',
        ],
      },
      {
        heading: 'Syntax',
        bullets: [
          '**bold** — **bold text**',
          '*italic* — *italic text*',
          '~~strike~~ — ~~strikethrough~~',
          '`code` — inline monospace',
          '[label](https://…) — link (https only, opens in a new tab)',
          '{color:danger}text{/color} — coloured text with a named colour',
          '{color:#0f766e}text{/color} — coloured text with a hex code (#rgb, #rrggbb, or #rrggbbaa)',
        ],
      },
      {
        heading: 'Social & video embeds',
        paragraphs: [
          'Use the embed() expression in Message or Question text to show an inline player. Type {{ in the field and pick embed from Functions, or paste a full expression. Chat messages that include an embed use a wider bubble so the player is readable.',
        ],
        bullets: [
          '{{embed("https://www.youtube.com/watch?v=…")}} — YouTube (watch, youtu.be, shorts, embed URLs)',
          '{{embed("https://x.com/user/status/…")}} — X / Twitter post (x.com or twitter.com)',
          '{{embed("https://vimeo.com/…")}} — Vimeo',
          '{{embed("https://open.spotify.com/track/…")}} — Spotify track, album, playlist, episode, or show',
          '{{embed("https://www.tiktok.com/@user/video/…")}} — TikTok',
          '{{embed(vars.video_url)}} — URL stored in a variable (Problems checks that the variable exists)',
          'Preview and public chat render a sandboxed iframe with an Open link; email and other non-chat uses get the plain URL',
          'Only known hosts are allowed — unknown URLs fail at runtime with a clear error',
        ],
        code: 'Watch this overview:\n\n{{embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}}\n\nOr from a variable:\n{{embed(vars.promo_video)}}',
      },
      {
        heading: 'Opening hours card',
        paragraphs: [
          'When a Message or Question includes {{templates.your_hours.text}}, Preview and public chat show a schedule card: timezone, each weekday with open–close or Closed, today’s row highlighted, and an Open now / Closed now chip when the clock can be resolved. Email and other non-chat uses still get plain text lines.',
        ],
      },
      {
        heading: 'Media & downloadable files',
        bullets: [
          '{{renderFile(media.welcome_png)}} — inline image, video, or audio from the Media library',
          '{{templates.invoice.file}} — downloadable PDF / Word / Excel chip from a Downloadable file template',
          'You can also attach files on the step with the media picker (shown with the message without an expression)',
        ],
      },
      {
        heading: 'Named colours',
        bullets: [
          'accent — theme accent (teal)',
          'highlight — orange highlight',
          'danger — red / error',
          'warning — amber / caution',
          'success — green / positive',
          'muted — subdued / secondary text',
          'ink — default body text',
          'teal, cyan, orange, red, green, blue — fixed palette colours',
        ],
      },
      {
        heading: 'Nesting',
        paragraphs: [
          'Marks can be combined: {color:danger}**Important**{/color} renders bold red text. Colours wrap bold, italic, strike, code, and links.',
        ],
      },
      {
        heading: 'Escaping',
        paragraphs: [
          'Prefix a mark character with a backslash to show it literally: \\* \\` \\~ \\[ \\{ \\\\. Underscores are intentionally not used as marks so that email addresses like user_name@example.com display normally.',
        ],
      },
      {
        heading: 'Example',
        code: 'Welcome, **{{vars.user.email}}**\n\n{color:success}Sign-in successful{/color}\nYour token: `{{vars.auth_token}}`\nRead more: [Help centre](https://example.com/help)\n\n{{embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}}',
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
          'Global variables are defined per chatbot (Settings → Global variables — add, edit, or remove) and seeded into Preview. Step outputs can also write variables. Use template fields anywhere you see the insert helper. Click a reference chip in the inspector to edit it.',
        ],
      },
      {
        heading: 'References',
        bullets: [
          '{{vars.name}} — a variable value',
          '{{steps.step_key.response}} — a previous question answer',
          '{{steps.http_1.data}} — data from an HTTP step (shape depends on the response)',
          '{{media.welcome_png.url}} — public URL of a chatbot media file',
          '{{embed("https://www.youtube.com/watch?v=…")}} — YouTube / X / Vimeo / Spotify / TikTok player in chat',
          '{{embed(vars.video_url)}} — social embed from a variable',
          '{{renderFile(media.welcome_png)}} — inline image/file preview in chat',
          '{{templates.store_hours.text}} — opening hours schedule card',
          '{{templates.invoice.file}} — downloadable file chip',
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
        code: 'Hello {{concat(vars.first_name, " ", vars.last_name)}}!\n{{if(empty(vars.email), "No email on file", vars.email)}}\n{{parseJson(vars.payload).items[0].name}}\nSubmitted {{prettify(utcNow(), "relative")}}\nDue {{prettify(dateAdd(utcNow(), 7, "days"), "date")}}\n\n{{embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}}',
      },
      {
        heading: 'Chat-only helpers',
        bullets: [
          'embed("https://…") — YouTube, X, Vimeo, Spotify, or TikTok player in Message / Question text (see Message formatting)',
          'renderFile(media.key) — Media library preview in chat (see Media library)',
        ],
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
          'Connection steps (HTTP, email, entity, integration, transfer, sign-in) execute against your configured backends during preview when available.',
          'Preview and published chat hide scrollbars on the message list, shop catalog, image-choice gallery, and similar panels so the widget stays uncluttered. Those areas still scroll.',
          'Publish stores the current graph so runtime consumers can use a stable version of the flow. When Staging is enabled for the organisation, you can publish to staging, open a staging public link, then promote to production.',
        ],
      },
    ],
  },
  {
    id: 'connections',
    title: 'Connections',
    summary: 'Reusable HTTP, email, and payment backends for your organisation.',
    body: [
      {
        paragraphs: [
          'Connections are defined at the organisation level. Bind a chatbot’s HTTP request, Database, or Send email steps, a Payment question, or Sign-in HTTP/OTP delivery to a connection. Credentials stay in connection secrets and are only used on the server. Connections are separate from Integrations (Slack, Drive, Sheets, and similar) — see Integrations.',
        ],
        image: {
          src: 'docs/connections.png',
          alt: 'Connections page listing HTTP and email organisation connections',
          caption: 'Organisation Connections — HTTP, email, and payment backends.',
        },
      },
      {
        bullets: [
          'HTTP — methods, paths, parameters, and response schema hints for autocomplete.',
          'Email — send templated messages through a configured email connection (also used for OTP delivery).',
          'Payment — PayFast merchant ID/key/passphrase, or a custom notify shared secret. The API confirms charges at /payment/notify; chat polls /payment/status.',
          'Database — PostgreSQL (incl. Supabase/Neon), MySQL/MariaDB, SQL Server, or SQLite (allowlisted path on the API host). Use a Database step with parameterized SQL (:name placeholders); secrets stay on the server. On gkjtt, the connection lab SQLite file is under /flowforge/demo/data.',
          'Visibility may include personal connections and shared catalogs depending on your deployment.',
        ],
      },
      {
        heading: 'My connections vs ForgeHub',
        paragraphs: [
          'The Connections page has two tabs. My connections lists credentials owned by this organisation (and personal ones where enabled). ForgeHub is a catalog — browse global and shared definitions, plus your own private connections, and install them into a selected chatbot. After install, re-check secrets and bindings; shared packs do not copy live credentials. Private stays hidden from other people, but you can still install your private connections onto other chatbots you edit.',
        ],
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    summary: 'Connect Slack, Drive, Sheets, S3, and similar providers for Integration steps.',
    body: [
      {
        paragraphs: [
          'Create integrations on a chatbot’s Data → Integrations section (same place as Connections), or from the organisation Integrations page while choosing an owning chatbot. Connect providers such as Microsoft OneDrive, Google Drive, Dropbox, Box, SharePoint, Slack, Microsoft Teams, Google Sheets, Notion, S3, or a custom API connector. Mark accounts connected or disconnected as needed.',
        ],
      },
      {
        bullets: [
          'An integration is owned by one chatbot and auto-installed there. Install the same account onto other chatbots from their Data tab.',
          'On an Integration step in the designer, only installed integrations appear. Pick the account, choose an action, map fields, and optionally store the result in a variable.',
          'Integrations are separate from HTTP/email/payment Connections — use Connections for generic REST and mail; use Integrations for provider-specific actions.',
          'After marketplace install, rebind integrations — IDs are stripped from packs.',
          'Slack integrations can also power Alerts digests and threshold Slack notifications (organisation-wide list).',
        ],
      },
    ],
  },
  {
    id: 'entities',
    title: 'Entities & data',
    summary: 'Store structured records your flows can query and update — and share across chatbots with CRUD grants.',
    body: [
      {
        paragraphs: [
          'Open a chatbot’s Data tab to define entities (static or dynamic), attributes, and records. Every entity has a locked unique primary key attribute `id` (auto-generated UUID on new records). On the Data tab, use Query filters above the records table to find rows (AND/OR, equals, contains, comparisons). Entity steps in the designer can query, get, create, update, or delete records with the same filter builder and optional {{vars.*}} bindings. Export records to Excel from the records table, or use Import Excel to create a new entity from an .xlsx/.csv file (header row, optional type row, then data).',
        ],
      },
      {
        heading: 'Sharing across chatbots',
        paragraphs: [
          'Entities stay owned by one chatbot. Set visibility to Private, Shared (listed for selected people), or Global (listed for the organisation). Install an entity onto other chatbots with per-install CRUD flags: query, create, update, and delete. Only the owning chatbot can edit schema and attributes; installed chatbots see a read-only schema and record access limited by their flags. Entity steps only list installed entities and hide actions the install does not allow.',
        ],
      },
      {
        bullets: [
          'Use output variables to capture entity results for later steps.',
          'Keep attribute keys stable — flows and filters reference them by key.',
          'Use attribute type password for credentials used by Sign-in → Entity lookup. Values are hashed (PBKDF2) when saved; the Data grid never shows the hash or plaintext.',
          'The `id` primary key cannot be renamed, removed, or edited after create. On Entity → Create, leave `id` empty to generate a UUID automatically.',
          'Query filters replace the older single “filter attribute equals” field (still supported on existing flows).',
          'Excel export writes attribute keys, a type row, then values so re-import can rebuild the entity.',
          'Owner auto-installs with full CRUD. Other bots install query-only by default — raise grants on the owning Data tab or when sharing.',
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
          'Downloadable file — PDF, Word, or Excel filled from template inputs (and leftover {{vars.*}}). List layout stacks fields; Page layout is an A4 canvas (portrait or landscape). Insert {{templates.key.file}} on a Message or End step; visitors download the built file.',
          'Agreement — Adobe Sign–style PDF: agreement name, message, terms, parties, signature image, and date signed. Insert {{templates.agreement.file}} after a Signature question.',
          'Menu, chat message, opening hours (schedule card in chat; plain text elsewhere), legal copy, and receipts.',
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
          'Each product can have an optional stock count. Empty means unlimited. At 0 the shop disables add-to-cart; quantities cannot exceed remaining stock. Stock decrements only when a Payment connection verifies the charge via /payment/notify (PayFast ITN or custom notify) — idempotent per payment. Self-confirm payments (no Payment connection) and Preview without a live notify do not reduce catalog stock. Overlapping chats can still race without a separate inventory ledger.',
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
          'Create a Downloadable file or Agreement template. For e-sign, use Agreement (PDF with parties, terms, signature, and date). Bind inputs on the Message or End step that inserts {{templates.agreement.file}} — visitors get a download chip; the file is built from that conversation when they click it.',
        ],
        bullets: [
          'List layout — stacked title, intro, fields, body, and footer. Use this for a simple form-style file.',
          'Data table — set Rows source to an array ({{inputs.lines}} / {{vars.items}}) and map columns (property key → header). Excel gets a header plus one row per item; PDF/Word list the same table.',
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
    id: 'conversations',
    title: 'Conversations',
    summary: 'Search, filter, replay, and export live and historical sessions.',
    body: [
      {
        paragraphs: [
          'Open Conversations from the primary nav to search sessions across chatbots. Filter by chatbot, status (active, escalated, completed, failed, abandoned), environment (production or staging), and tags. Export the current list as CSV. Agents see escalated and assigned sessions for their work; editors and admins see the full organisation history.',
        ],
        image: {
          src: 'docs/conversations.png',
          alt: 'Conversations list with search, status filters, and session table',
          caption: 'Conversations — search, filter by environment/status, and export CSV.',
        },
      },
      {
        heading: 'Session detail',
        bullets: [
          'Open a row to replay the transcript, inspect variables, visitor key, publish version, and SLA badges.',
          'On escalated chats: claim, send replies, transfer to another agent or queue, add notes/tags, and resolve.',
          'Export the session as JSON for support or debugging.',
          'Abandoned sessions may appear after the visitor goes stale without completing.',
        ],
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    summary: 'Volume, completion, drop-off, payments, transfers, and experiments.',
    body: [
      {
        paragraphs: [
          'Open Analytics in the organisation to see session volume over time, completion vs abandoned vs failed, when people chat, and how far sessions reach (step.run events). Filter by chatbot and date range. Shop carts show conversion to a paid intent and product quantities from completed session variables. Conversation completed/failed webhooks include those same session variables. Compare publish versions with the drop-off version picker when available.',
        ],
        image: {
          src: 'docs/analytics.png',
          alt: 'Analytics page with funnel, cohorts, experiments, and chatbot transfers',
          caption: 'Analytics — funnel, cohorts, experiments, and transfer outcomes.',
        },
      },
      {
        heading: 'Panels',
        bullets: [
          'Sessions over time, status mix, drop-off by step, by publish version, and version compare.',
          'Activity by hour and volume/completion by chatbot.',
          'Top products from completed session carts.',
          'Server analytics (funnel by step, weekly cohorts, revenue by node) when available.',
        ],
      },
      {
        heading: 'Transfers',
        paragraphs: [
          'The Chatbot transfers panel counts sessions that fired session.transferred, completion vs abandon after transfer, from→to pairs, and session.transfer_failed events (for example missing required variables).',
        ],
      },
      {
        heading: 'Experiments',
        paragraphs: [
          'When experiments are enabled for the organisation, Analytics includes an Experiments panel to define control/treatment variants and view stats. Wire live traffic to published graphs as your experiment setup allows.',
        ],
      },
    ],
  },
  {
    id: 'inbox-agents',
    title: 'Inbox & agent console',
    summary: 'Live handoff queues, skills, concurrency, and the agent Inbox.',
    body: [
      {
        paragraphs: [
          'When a flow hits Handoff, the conversation escalates to Inbox. Operators claim, reply, transfer to another agent or queue, add notes/tags, and resolve. Presence heartbeats show who is online. Users with the Agent role only see Inbox and Conversations; owners, admins, and editors can also operate the Inbox.',
        ],
        image: {
          src: 'docs/inbox.png',
          alt: 'Agent inbox with queue and assignee filters',
          caption: 'Inbox — claim and work escalated conversations by queue.',
        },
      },
      {
        heading: 'Inbox filters',
        bullets: [
          'Queue — all queues or a specific Agent console queue.',
          'Assignee — anyone, me, or unassigned.',
          'Saved views — save the current filters for quick return.',
          'Toggle yourself online from the presence control so auto-assign and “agents online” count include you.',
        ],
      },
      {
        heading: 'Agent console',
        bullets: [
          'Open Agent console from the primary nav or Admin menu (owners/admins manage queues and profiles).',
          'Queues — name, description, first-response and resolve SLAs (seconds), default flag, and routing rules (required skills, match any vs all, auto-assign).',
          'Profiles — display name, skills, and max concurrent open escalations (enforced on claim and assign).',
          'Handoff steps can target a specific queue; otherwise the default queue is used. Auto-assign picks an online operator whose skills match and who is under max concurrent.',
        ],
        image: {
          src: 'docs/agent-console.png',
          alt: 'Agent console queue form with skills, SLAs, and auto-assign',
          caption: 'Agent console — queues, skills, SLAs, and concurrency.',
        },
      },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    summary: 'Publish and install serialized flow packs across organisations.',
    body: [
      {
        paragraphs: [
          'Publish a listing from a source chatbot to serialize a flowforge.chatbotFlow pack (steps, globals, templates, entities, scenarios). Choose kind (flow pack or template pack) and visibility (private, organisation, or public — public needs approval). Connection and integration IDs are stripped — rebind after install. Install creates a new chatbot from the pack (or falls back to a live clone for legacy listings).',
        ],
        image: {
          src: 'docs/marketplace.png',
          alt: 'Marketplace listings with Install and Publish a pack form',
          caption: 'Marketplace — publish packs from a chatbot or install into this organisation.',
        },
      },
    ],
  },
  {
    id: 'staging',
    title: 'Staging',
    summary: 'Publish to staging, test, then promote to production.',
    body: [
      {
        paragraphs: [
          'When the organisation has the Staging feature enabled, the designer can publish to staging, then test before promoting to production. Each chatbot has a **Test** tab with a unique staging link (`/test/{token}`) that runs the staging graph without enabling production public chat. You can watch live sessions and transcripts there, and review staging-only stats (sessions, completion, drop-off). The older staging public link (`?env=staging` on the production URL) still works when public chat is enabled. Conversations and Analytics support filtering by environment (production vs staging).',
        ],
      },
    ],
  },
  {
    id: 'admin-overview',
    title: 'Admin overview',
    summary: 'Organisation dashboard for chatbots, users, usage, webhooks, and recent activity.',
    body: [
      {
        paragraphs: [
          'Owners and admins open Admin from the top bar to manage the organisation beyond flow design. The Overview page is the landing dashboard: counts for active chatbots, users (and pending invites), recycle-bin items, this month’s usage, webhook subscriptions, and a shortcut to Organisation settings. Recent activity lists the latest audit events with a link to the full Audit log.',
        ],
        image: {
          src: 'docs/admin-overview.png',
          alt: 'Admin overview with stat cards and recent activity',
          caption: 'Admin → Overview — organisation health and shortcuts.',
        },
      },
      {
        heading: 'Admin menu vs primary nav',
        bullets: [
          'Admin tab strip — Overview, Chatbots (inventory), Users, Recycle bin, Organisation, Compliance, Security, Usage, Webhooks, Audit.',
          'Also in the Admin dropdown (outside the tab strip) — Agent console, Integrations, Alerts.',
          'Primary nav — Chatbots home (design), Connections, Conversations, Inbox, Agent console, Analytics, Marketplace.',
          'Admin → Chatbots is an inventory for search and bulk soft-delete; day-to-day design stays on the Chatbots home.',
        ],
      },
    ],
  },
  {
    id: 'organisation-settings',
    title: 'Organisation settings',
    summary: 'Profile, contact, billing address, and workspace branding.',
    body: [
      {
        paragraphs: [
          'Open Admin → Organisation to edit display name, legal name, slug, contact email, phone, website, billing address, and internal notes. The contact email is used for Alerts digests and threshold email notifications.',
        ],
        image: {
          src: 'docs/organisation.png',
          alt: 'Organisation settings form with profile and contact fields',
          caption: 'Admin → Organisation — profile, contact, and branding.',
        },
      },
      {
        heading: 'Workspace branding',
        bullets: [
          'Product name override — leave blank to keep FlowForge in the shell.',
          'Accent color and logo URL for the organisation chrome.',
          'Optionally apply branding to public chat (accent, logo, and product name on published chatbot pages).',
        ],
      },
    ],
  },
  {
    id: 'recycle-bin',
    title: 'Recycle bin',
    summary: 'Restore soft-deleted chatbots or delete them forever.',
    body: [
      {
        paragraphs: [
          'Deleting a chatbot from the Chatbots home or Admin → Chatbots moves it to the Recycle bin and turns off public chat for that bot. Open Admin → Recycle bin (or Recycle bin from the Chatbots home) to restore a bot or delete it forever. Empty recycle bin permanently removes everything in the bin.',
        ],
        image: {
          src: 'docs/recycle-bin.png',
          alt: 'Recycle bin page for deleted chatbots',
          caption: 'Admin → Recycle bin — restore or permanently delete chatbots.',
        },
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
          'Owners and admins open Admin → Users to invite people by email and change roles (admin, editor, agent, or viewer). New invites appear as Pending until accepted; you can copy a signup link. Edit display name and job title on members. Ownership is managed separately. Viewers and agents cannot manage users. Agents invited for live support land on Inbox after sign-in.',
        ],
        image: {
          src: 'docs/admin-users.png',
          alt: 'Admin Users table with roles and Add user',
          caption: 'Admin → Users — invite members and assign roles.',
        },
      },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    summary: 'Retention, consent policies, and visitor data export or delete.',
    body: [
      {
        paragraphs: [
          'Owners and admins open Admin → Compliance for data retention, visitor subject requests, and consent policies.',
        ],
        image: {
          src: 'docs/compliance.png',
          alt: 'Compliance page with retention TTLs and visitor data export',
          caption: 'Admin → Compliance — retention, legal hold, and visitor export/delete.',
        },
      },
      {
        heading: 'Data retention',
        bullets: [
          'Set TTL days for sessions, events, files, and payment PII.',
          'Enable Legal hold to block deletes and purge while an investigation is open.',
          'Run retention purge to delete expired data according to those TTLs (blocked while legal hold is on).',
        ],
      },
      {
        heading: 'Visitor data subject requests',
        paragraphs: [
          'Enter a visitor key to Export JSON (GDPR-style access) or Delete data for that visitor across the organisation.',
        ],
      },
      {
        heading: 'Consent policies',
        paragraphs: [
          'Add versioned policies with a policy_key, title, and body. Wire consent capture in public chat when your flows require it; policy versions help you prove which text was shown.',
        ],
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & SSO',
    summary: 'Organisation SSO, domains, SCIM, and Platform API tokens.',
    body: [
      {
        paragraphs: [
          'Owners and admins open Admin → Security to configure enterprise login for FlowForge staff. Visitor Sign-in SSO uses chatbot Templates (kind SSO / IdP), then the Sign-in step references that template by key — separate from organisation staff SSO.',
        ],
        image: {
          src: 'docs/security.png',
          alt: 'Security page for OIDC/SAML SSO and SCIM configuration',
          caption: 'Admin → Security — SSO, SCIM, and Platform API tokens.',
        },
      },
      {
        heading: 'SSO configs',
        bullets: [
          'Protocol — OIDC (issuer, client ID, authorization/token/JWKS URLs) or SAML (entity ID, SSO/ACS URLs, PEM certificate).',
          'Email domains — comma-separated domains allowed to use this IdP.',
          'Default role for new SSO users (viewer, editor, or admin).',
          'Enable the config and optionally Enforce SSO so members must use the IdP.',
        ],
      },
      {
        heading: 'Platform API tokens',
        paragraphs: [
          'Create a long-lived `ffpat_` token for service accounts calling `/v1`. It is shown once. The PHP API verifies it, then reads this organisation with the server database key. Revoke to cut off a client immediately. Session JWTs from `/docs/api` still work for interactive tests but expire.',
        ],
      },
      {
        heading: 'SCIM',
        paragraphs: [
          'Create a SCIM token for directory sync against `/api/scim/v2/`. The token is shown once — store it securely.',
        ],
      },
    ],
  },
  {
    id: 'usage',
    title: 'Usage & quotas',
    summary: 'Monthly conversation, email, and HTTP limits plus host allowlist.',
    body: [
      {
        paragraphs: [
          'Open Admin → Usage to see this month’s consumption against quotas for conversations, emails, and HTTP calls. Set monthly maxima and an optional HTTP host allowlist (comma-separated hosts). An empty allowlist means the platform default policy applies.',
        ],
        image: {
          src: 'docs/usage.png',
          alt: 'Usage and quotas page with monthly bars and allowlist',
          caption: 'Admin → Usage — meters, quotas, and HTTP host allowlist.',
        },
      },
    ],
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    summary: 'Outbound events when flows publish or conversations finish.',
    body: [
      {
        paragraphs: [
          'Open Admin → Webhooks to notify external systems. Add a name, HTTPS URL, and one or more events: flow.published, conversation.completed, conversation.failed. Enable or disable subscriptions without deleting them. Conversation completed and failed payloads include the session’s variables. Recent deliveries lists the last 50 attempts across the organisation.',
        ],
        image: {
          src: 'docs/webhooks.png',
          alt: 'Webhooks page with Add webhook and recent deliveries',
          caption: 'Admin → Webhooks — subscriptions and delivery history.',
        },
      },
    ],
  },
  {
    id: 'alerts',
    title: 'Alerts',
    summary: 'Weekly digests and threshold rules for organisation health.',
    body: [
      {
        paragraphs: [
          'Open Alerts from the Admin menu. Emails use the organisation contact email (set under Organisation settings). Threshold rules and digests also create in-app notifications for owners and admins.',
        ],
        image: {
          src: 'docs/alerts.png',
          alt: 'Alerts page with weekly digest and threshold rules',
          caption: 'Alerts — weekly digest and abandon/failure/quota rules.',
        },
      },
      {
        heading: 'Weekly digest',
        bullets: [
          'Enable the digest and pick a UTC weekday.',
          'Optionally post to a connected Slack integration.',
        ],
      },
      {
        heading: 'Threshold rules',
        bullets: [
          'Metrics — abandon rate ≥ %, failed sessions ≥ count, completion rate ≤ %, or conversation quota used ≥ %.',
          'Set a threshold and rolling window in hours; notify by email and/or Slack.',
          'Rules show a live status (for example OK with the current metric value).',
        ],
      },
    ],
  },
  {
    id: 'audit',
    title: 'Audit log',
    summary: 'Security and admin activity for the organisation.',
    body: [
      {
        paragraphs: [
          'Open Admin → Audit for a chronological table of When, Action, Resource, and Meta. Typical actions include flow.published, marketplace.published / installed / deleted, and chatbot.cloned. Owners and admins use this for security review; the Overview Recent activity panel is a short preview of the same stream.',
        ],
        image: {
          src: 'docs/audit.png',
          alt: 'Audit log table with actions and resource metadata',
          caption: 'Admin → Audit — organisation activity log.',
        },
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    summary: 'In-app alerts for handoffs, comments, publishes, members, and threshold alerts.',
    body: [
      {
        paragraphs: [
          'The bell in the top bar shows unread notifications for your account. Inside an organisation it focuses on that organisation; elsewhere it shows all of yours. Click an item to open the related page and mark it read, or use Mark all.',
        ],
      },
      {
        heading: 'What creates a notification',
        bullets: [
          'Handoff — when a live chat escalates (Agent role; owners/admins if no agents), when a conversation is assigned or transferred to you, and when a visitor messages during an escalated chat.',
          'Design — new flow comments notify owners, admins, and editors; publishing a flow notifies the same roles (except the publisher).',
          'Users — when someone accepts an invite, owners and admins are notified.',
          'Alerts — threshold rules and weekly digests also create in-app notifications for owners and admins (alongside email/Slack when configured).',
        ],
      },
    ],
  },
  {
    id: 'platform-api',
    title: 'Platform API',
    summary: 'OpenAPI 3.0 contract for the FlowForge HTTP API — import into Postman.',
    body: [
      {
        paragraphs: [
          'The Platform API is a REST read API for chatbot-rich data: organisations, chatbots, published flow JSON, designer export packs, media, templates, entities, conversations (with transcripts), and analytics. It is not the internal SMTP/invite sidecar — those remain separate runtime routes.',
        ],
      },
      {
        heading: 'Where to get a token',
        bullets: [
          'For service accounts: Organisation → Admin → Security → create a Platform API token. The ffpat_ value is shown once.',
          'The PHP API verifies that token, then uses the server service_role key to read the database. You never send service_role yourself.',
          'Tokens are scoped to one organisation and last until you revoke them (or until the optional expiry).',
          'A signed-in session JWT from /docs/api still works for a quick Postman test but expires in about an hour.',
        ],
        code: 'Authorization: Bearer ffpat_…\nContent-Type: application/json',
      },
      {
        heading: 'Import into Postman',
        bullets: [
          'Open /docs/api for the human reference and download buttons.',
          'Download OpenAPI JSON from GET /openapi.json and import it: Postman → File → Import.',
          'Or import the Postman Collection plus Environment (GET /postman.json and /postman-environment.json).',
          'Set baseUrl to your API origin and paste the copied token into accessToken. Then call GET /v1/me and GET /v1/organisations/{id}/chatbots.',
        ],
      },
      {
        heading: 'Interactive docs',
        paragraphs: [
          'GET /docs on the API origin renders the same spec with Redoc. Live try-it-out is easiest from Postman after import.',
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
      'FlowForge is a multi-organisation chatbot builder. Organisations design conversational flows with questions, conditions, HTTP/email/payment connections, Integrations, entities, shop checkout, agent handoff, and chatbot transfer — then preview, publish (optionally via staging), monitor Conversations and Analytics, and manage Users, Compliance, Security, Usage, Webhooks, and Alerts from Admin.',
  },
  {
    id: 'terms-privacy',
    question: 'Where are the Terms of Service and Privacy Policy?',
    answer:
      'Open Terms at /terms and Privacy at /privacy (also linked in the site footer, sign-in, and sign-up). They cover accounts, organisation content, chat visitors, connections, APIs, and retention tools. Chat visitors should also check the notice of the organisation running the bot they are talking to.',
  },
  {
    id: 'pricing-plans',
    question: 'How does FlowForge pricing work?',
    answer:
      'See /pricing for Starter, Pro, Business, and Enterprise. Plans map to real product capacity — conversations/email/HTTP quotas, staging, agent console, compliance, Platform API, and SSO/SCIM. Sign in to use your organisation workspace, or contact Help for Enterprise.',
  },
  {
    id: 'instance-vs-chatbot',
    question: 'What is the difference between an organisation and a chatbot?',
    answer:
      'An organisation is a client account (tenant) with its own users, connections, integrations, and chatbots. A chatbot is one conversational product inside that organisation, with its own settings, flow design, templates, and data.',
  },
  {
    id: 'who-can-edit',
    question: 'Who can edit flows?',
    answer:
      'Owners, admins, and editors can change designs and most chatbot settings. Viewers can inspect but not modify. Agents cannot edit flows — they only use Inbox and Conversations for live handoffs. Access is managed under Admin → Users.',
  },
  {
    id: 'agent-role',
    question: 'What is the Agent role?',
    answer:
      'Agents handle live support: claim escalated chats in Inbox, reply, transfer to another agent or queue, and resolve. After sign-in they land on Inbox and cannot open Design, Connections, Analytics, Marketplace, or Admin. Configure queues and skills in Agent console (owners/admins).',
  },
  {
    id: 'recycle-bin',
    question: 'What happens when I delete a chatbot?',
    answer:
      'Delete moves it to the Recycle bin (Admin → Recycle bin or from the Chatbots home) and turns off public chat. Owners and admins can restore it, or permanently delete it (and its files) from the Recycle bin / Empty recycle bin. Permanent delete cannot be undone.',
  },
  {
    id: 'conversation-replay',
    question: 'How do I replay a public conversation?',
    answer:
      'Open Conversations in the organisation. Filter by chatbot, status, environment (production/staging), or tags, then click a session to replay the transcript, inspect step runs, export JSON, and view saved variables. Agents typically see escalated or assigned sessions first. Sessions still marked active after a day are shown as abandoned. See Documentation → Conversations.',
  },
  {
    id: 'analytics',
    question: 'Where can I see drop-off and payment conversion?',
    answer:
      'Open Analytics next to Conversations. Filter by chatbot and date range to see session volume, completion, drop-off by step, when people chat, payment conversion, products from completed session carts, chatbot transfers, and (when enabled) experiments and server analytics panels.',
  },
  {
    id: 'admin-where',
    question: 'Where do I manage organisation settings, quotas, and security?',
    answer:
      'Open Admin from the top bar. Overview is the dashboard. Organisation covers profile and branding; Users invites people; Compliance and Security cover retention and SSO; Usage sets quotas and the HTTP allowlist; Webhooks and Audit cover outbound events and the activity log. Alerts and Integrations are also in the Admin dropdown.',
  },
  {
    id: 'connections-vs-integrations',
    question: 'What is the difference between Connections and Integrations?',
    answer:
      'Connections are chatbot-owned HTTP, email, payment, and database backends (with install links) used by HTTP request, Send email, Payment, and Sign-in steps. Integrations are provider connectors (Slack, Drive, Sheets, S3, …) also owned/installed per chatbot under Data → Integrations, and used by Integration steps. Slack accounts remain available organisation-wide for Alerts.',
  },
  {
    id: 'autosave-publish',
    question: 'Do I need to save before previewing?',
    answer:
      'The designer autosaves as you edit. Preview uses your current draft. Publish creates a published graph snapshot for a stable runtime version. With Staging enabled, publish to staging first, then promote to production.',
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
      'Set Response to Shop and pick a Store catalog. Visitors browse products, add them to a cart, and checkout. Optional product stock lives on the catalog (empty = unlimited); sold-out items cannot be added and quantities cannot exceed remaining stock. Stock decrements only when a Payment connection verifies via /payment/notify — self-confirm without a connection does not reduce stock. Checkout lists the product subtotal, each catalog fee, then the total. Fees are a fixed amount or a percent of subtotal and apply only when the cart has items. Charge {{vars.cart.total}} on the following Payment step. After payment, insert {{templates.receipt.text}} (or .html in Email) so line items, totals, and the payment reference fill in automatically.',
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
    id: 'social-embed',
    question: 'How do I embed a YouTube video or X post in a message?',
    answer:
      'In a Message or Question prompt, insert {{embed("https://www.youtube.com/watch?v=…")}} (or an X, Vimeo, Spotify, or TikTok URL). You can also use {{embed(vars.video_url)}} when the URL is stored in a variable. Preview and public chat show an inline player; email falls back to the plain link. See Documentation → Message formatting.',
  },
  {
    id: 'document-download',
    question: 'How do I let visitors download a filled PDF, Word, or Excel file?',
    answer:
      'On Templates, create a Downloadable file (PDF, Word, or Excel). Declare inputs on the template ({{inputs.name}}, {{inputs.signature}} for a drawn signature) and bind them on the Message or End step that inserts {{templates.your_key.file}}. Use List layout for a stacked form, or Page layout to place blocks on an A4 page (portrait or landscape): drag to move, type millimetres for Left/Top/Width/Height (any decimals; lines down to 0.1 mm), snap to the grid (hold Alt to move freely), then set font, bold, and colors. PDF matches the page; Word and Excel follow the same order. Visitors get a download chip; the file is filled when they click it.',
  },
  {
    id: 'http-fail',
    question: 'What happens if an HTTP request fails?',
    answer:
      'The step is marked Failed. Downstream steps can use Run after → has failed to continue on that path, or stay gated on success only (the default). Sign-in steps use Success / Fail edges the same way.',
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
      'Yes. Export the flow as JSON from the designer/chatbot tools, then import it into another chatbot — or publish/install a Marketplace pack. Review connection and integration IDs and entity references after import — they may need remapping.',
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
  {
    id: 'platform-api',
    question: 'How do I call the Platform API from Postman?',
    answer:
      'Create a long-lived ffpat_ token on Admin → Security (shown once). In Postman: File → Import the OpenAPI or collection, set baseUrl, paste the token into accessToken. Start with GET /v1/me. Session JWTs from /docs/api also work but expire. Never send anon/service_role.',
  },
  {
    id: 'platform-api-token',
    question: 'Why does the Platform API say Missing or invalid Authorization bearer token?',
    answer:
      'Create a Platform API token (ffpat_) on Admin → Security and send Authorization: Bearer. Do not send the anon or service_role key. Session JWTs also work but expire. If the token was revoked or mistyped you get this 401. Spec downloads (/openapi.json, /postman.json) do not need a token.',
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
    title: 'Format messages and embed video',
    description:
      'Bold, colour, links, and {{embed("https://…")}} for YouTube, X, Vimeo, Spotify, or TikTok in Message and Question text.',
    to: '/docs#message-formatting',
  },
  {
    title: 'Attach media to a step',
    description: 'Upload files in the Design page Media library, then attach them on Message, Question, or End steps.',
    to: '/docs#media',
  },
  {
    title: 'Call an API from a step',
    description: 'Create an HTTP connection, bind it on an HTTP request step, map params, and Preview.',
    to: '/docs#connections',
  },
  {
    title: 'Add an Integration step',
    description: 'Connect Slack, Drive, Sheets, or S3 under Integrations, then call an action from the designer.',
    to: '/docs#integrations',
  },
  {
    title: 'Escalate to the Inbox',
    description: 'Add a Handoff step, pick a queue in Agent console, and claim chats in Inbox.',
    to: '/docs#inbox-agents',
  },
  {
    title: 'Transfer between chatbots',
    description: 'Map variables, choose a start step (not End), or return to the previous bot.',
    to: '/docs#designer',
  },
  {
    title: 'Publish to staging',
    description: 'When Staging is enabled, publish a staging graph, test with ?env=staging, then promote.',
    to: '/docs#staging',
  },
  {
    title: 'Install a marketplace pack',
    description: 'Browse approved packs, install a serialized flow, then rebind connections.',
    to: '/docs#marketplace',
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
    description: 'Open Admin → Users and assign admin, editor, agent, or viewer.',
    to: '/docs#members',
  },
  {
    title: 'Configure organisation Admin',
    description: 'Overview, branding, compliance, SSO, quotas, webhooks, alerts, and audit.',
    to: '/docs#admin-overview',
  },
  {
    title: 'Search and export conversations',
    description: 'Filter sessions by status and environment, open a transcript, or export CSV.',
    to: '/docs#conversations',
  },
  {
    title: 'Set usage quotas and allowlist',
    description: 'Cap monthly conversations, emails, and HTTP calls; restrict HTTP hosts.',
    to: '/docs#usage',
  },
  {
    title: 'Add outbound webhooks',
    description: 'Subscribe to flow.published and conversation completed/failed events.',
    to: '/docs#webhooks',
  },
  {
    title: 'Call the Platform API',
    description: 'Import OpenAPI into Postman, set a Platform API token, and call /v1.',
    to: '/docs/api',
  },
] as const
