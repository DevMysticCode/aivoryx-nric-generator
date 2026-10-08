const weights = [2, 7, 6, 5, 4, 3, 2]
const tables = {
  S: 'JZIHGFEDCBA',
  T: 'JZIHGFEDCBA',
  F: 'XWUTRQPNMLK',
  G: 'XWUTRQPNMLK',
}
const offsets = { S: 0, T: 4, F: 0, G: 4 }
const types = {
  S: 'NRIC S-series',
  T: 'NRIC T-series',
  F: 'FIN F-series',
  G: 'FIN G-series',
  M: 'FIN M-series',
}
const notes = {
  S: 'Checksum-valid synthetic NRIC test value',
  T: 'Checksum-valid synthetic NRIC test value',
  F: 'Checksum-valid synthetic FIN test value',
  G: 'Checksum-valid synthetic FIN test value',
  M: 'Format-only M-series FIN test value',
}
const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

const state = {
  records: [],
  format: 'plain',
  quickSeries: 'NRIC',
  quickId: '',
}

const $ = (id) => document.getElementById(id)

const calculateChecksum = (prefix, digits) => {
  const sum = digits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0)
  return tables[prefix][(sum + offsets[prefix]) % 11]
}

const randomDigits = () =>
  Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('')

const randomLetter = () => letters[Math.floor(Math.random() * letters.length)]

const makeId = (prefix, digits = randomDigits()) => {
  if (prefix === 'M') return `${prefix}${digits}${randomLetter()}`
  return `${prefix}${digits}${calculateChecksum(prefix, digits)}`
}

const pickPrefix = (choice) => {
  const options =
    choice === 'ANY'
      ? ['S', 'T', 'F', 'G']
      : choice === 'NRIC'
        ? ['S', 'T']
        : choice === 'FIN'
          ? ['F', 'G']
          : [choice]
  return options[Math.floor(Math.random() * options.length)]
}

const normalize = (value) => value.toUpperCase().replace(/[\s-]/g, '').trim()

const validate = (value) => {
  const normalized = normalize(value)

  if (!normalized) {
    return {
      normalized,
      level: 'invalid',
      title: 'Enter a value',
      message: 'Paste an NRIC or FIN to validate its structure.',
    }
  }

  if (!/^[A-Z][0-9]{7}[A-Z]$/.test(normalized)) {
    return {
      normalized,
      level: 'invalid',
      title: 'Invalid format',
      message: 'Expected one prefix letter, seven digits, and one trailing letter.',
    }
  }

  const prefix = normalized[0]
  const digits = normalized.slice(1, 8)
  const received = normalized[8]

  if (!['S', 'T', 'F', 'G', 'M'].includes(prefix)) {
    return {
      normalized,
      level: 'invalid',
      title: 'Unsupported prefix',
      message: 'Supported prefixes are S, T, F, G, and M.',
      prefix,
      received,
    }
  }

  if (prefix === 'M') {
    return {
      normalized,
      level: 'warning',
      title: 'Format valid, checksum not verified',
      message:
        'M-series FIN format is recognized, but this tool does not claim checksum validation because the official M rule is not publicly published.',
      prefix,
      received,
      type: types[prefix],
    }
  }

  const expected = calculateChecksum(prefix, digits)
  const ok = expected === received

  return {
    normalized,
    level: ok ? 'valid' : 'invalid',
    title: ok ? 'Checksum valid' : 'Checksum mismatch',
    message: ok
      ? 'The check letter matches the prefix and seven-digit sequence.'
      : 'The check letter does not match this prefix and digit sequence.',
    expected,
    received,
    prefix,
    type: types[prefix],
  }
}

const makeRecord = (prefix) => ({
  id: makeId(prefix),
  prefix,
  type: types[prefix],
  note: notes[prefix],
})

const qaPack = () => {
  const base = [
    { prefix: 'S', digits: '1234567' },
    { prefix: 'T', digits: '7654321' },
    { prefix: 'F', digits: '0000000' },
    { prefix: 'G', digits: '9999999' },
  ].map(({ prefix, digits }) => ({
    id: makeId(prefix, digits),
    prefix,
    type: types[prefix],
    note: 'Known checksum-valid fixture',
  }))

  return [
    ...base,
    {
      id: 'M1234567B',
      prefix: 'M',
      type: types.M,
      note: 'M-series format-only fixture',
    },
    {
      id: `${base[0].id.slice(0, 8)}A`,
      prefix: 'S',
      type: 'Invalid checksum',
      note: 'Valid shape with wrong check letter',
    },
    {
      id: 'A1234567Z',
      prefix: 'A',
      type: 'Unsupported prefix',
      note: 'Prefix should fail validation',
    },
    {
      id: 'S12A4567D',
      prefix: 'S',
      type: 'Malformed body',
      note: 'Middle characters must be digits',
    },
    {
      id: 's1234567d',
      prefix: 'S',
      type: 'Lowercase input',
      note: 'Validator should normalize case',
    },
  ]
}

const formatRecords = (records, format) => {
  const ids = records.map((record) => record.id)
  if (format === 'csv') {
    return [
      'id,prefix,type,note',
      ...records.map(
        (record) =>
          `"${record.id}","${record.prefix}","${record.type}","${record.note}"`,
      ),
    ].join('\n')
  }
  if (format === 'json') return JSON.stringify(records, null, 2)
  if (format === 'typescript') return `const nricFinTestIds = ${JSON.stringify(ids, null, 2)} as const`
  if (format === 'python') return `nric_fin_test_ids = ${JSON.stringify(ids, null, 2)}`
  if (format === 'sql') {
    return [
      'insert into test_identifiers (identifier, identifier_type) values',
      records
        .map(
          (record, index) =>
            `  ('${record.id}', '${record.type.replace(/'/g, "''")}')${
              index === records.length - 1 ? ';' : ','
            }`,
        )
        .join('\n'),
    ].join('\n')
  }
  return ids.join('\n')
}

const showToast = (message) => {
  const toast = $('toast')
  toast.textContent = message
  toast.classList.add('show')
  window.setTimeout(() => toast.classList.remove('show'), 1600)
}

const copy = async (value) => {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const field = document.createElement('textarea')
    field.value = value
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.append(field)
    field.select()
    document.execCommand('copy')
    field.remove()
  }
  showToast('Copied')
}

const exportValue = () => formatRecords(state.records, state.format)

const renderResults = () => {
  $('resultSummary').textContent = `${state.records.length} values ready for fixtures.`
  $('resultList').innerHTML = state.records
    .map(
      (record, index) => `
        <article class="result-item">
          <div class="id-value mono">${record.id}</div>
          <div>
            <div class="meta-title">${record.type}</div>
            <div class="meta-note">${record.note}</div>
          </div>
          <button class="copy-one" type="button" data-copy-index="${index}">Copy</button>
        </article>
      `,
    )
    .join('')
  $('exportPreview').textContent = exportValue()
}

const renderValidation = () => {
  const result = validate($('validatorInput').value)
  const detailRows = [
    ['Normalized', result.normalized || '-'],
    ['Series', result.type || result.prefix || '-'],
    ['Expected', result.expected || '-'],
    ['Received', result.received || '-'],
  ]

  $('validationResult').className = `validation-card ${result.level}`
  $('validationResult').innerHTML = `
    <div class="status">${result.title}</div>
    <div>${result.message}</div>
    <dl class="detail-grid">
      ${detailRows
        .map(
          ([label, value]) => `
            <div>
              <dt>${label}</dt>
              <dd class="mono">${value}</dd>
            </div>
          `,
        )
        .join('')}
    </dl>
  `
}

const generate = () => {
  const choice = $('seriesSelect').value
  const count = Math.min(250, Math.max(1, Number($('countInput').value) || 1))
  $('countInput').value = String(count)
  state.records = Array.from({ length: count }, () => makeRecord(pickPrefix(choice)))
  renderResults()
}

const renderQuickSeries = () => {
  document.querySelectorAll('[data-quick-series]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.quickSeries === state.quickSeries))
  })
}

const generateQuick = () => {
  const value = $('quickValue')
  state.quickId = makeId(pickPrefix(state.quickSeries))
  value.textContent = state.quickId
  value.classList.remove('copied', 'flash')
  void value.offsetWidth
  value.classList.add('flash')
  $('quickHint').textContent = 'Click the number to copy it'
  $('quickCopyButton').textContent = 'Copy'
}

const copyQuick = async () => {
  await copy(state.quickId)
  $('quickValue').classList.add('copied')
  $('quickHint').textContent = `${state.quickId} copied to clipboard`
  $('quickCopyButton').textContent = 'Copied'
}

const download = () => {
  const value = exportValue()
  const extension = state.format === 'json' ? 'json' : state.format === 'csv' ? 'csv' : 'txt'
  const blob = new Blob([value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `aivoryx-nric-fin-test-data.${extension}`
  link.click()
  URL.revokeObjectURL(url)
}

$('generateButton').addEventListener('click', generate)
$('quickGenerateButton').addEventListener('click', generateQuick)
$('quickCopyButton').addEventListener('click', copyQuick)
$('quickValue').addEventListener('click', copyQuick)
document.querySelectorAll('[data-quick-series]').forEach((button) => {
  button.addEventListener('click', () => {
    state.quickSeries = button.dataset.quickSeries
    try {
      localStorage.setItem('quickSeries', state.quickSeries)
    } catch {}
    renderQuickSeries()
    generateQuick()
  })
})
$('copyButton').addEventListener('click', () => copy(exportValue()))
$('copyPreviewButton').addEventListener('click', () => copy(exportValue()))
$('downloadButton').addEventListener('click', download)
$('qaButton').addEventListener('click', () => {
  state.records = qaPack()
  renderResults()
  showToast('QA pack loaded')
})
$('formatSelect').addEventListener('change', (event) => {
  state.format = event.target.value
  renderResults()
})
$('validatorInput').addEventListener('input', renderValidation)
$('resultList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy-index]')
  if (!button) return
  copy(state.records[Number(button.dataset.copyIndex)].id)
})

try {
  const saved = localStorage.getItem('quickSeries')
  if (['NRIC', 'FIN', 'ANY'].includes(saved)) state.quickSeries = saved
} catch {}

renderQuickSeries()
generateQuick()
generate()
renderValidation()
