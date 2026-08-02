// gateway/config/signatures.js
// Regex signature list used by Payload Guard. Config-driven on purpose so
// false-positive tuning (build Phase 4) is an edit here, not a code change.
// Reference: LLD S1.3
module.exports = [
  { name: 'sqli_union_select',   regex: /union\s+select/i },
  { name: 'sqli_or_1_equals_1', regex: /'\s*or\s*'?1'?\s*=\s*'?1/i },
  { name: 'sqli_drop_table',    regex: /drop\s+table/i },
  { name: 'sqli_insert',        regex: /insert\s+into/i },
  { name: 'sqli_comment',       regex: /(--|#)/ },
  { name: 'xss_script_tag',     regex: /<script[\s>]/i },
  { name: 'xss_onerror',        regex: /onerror\s*=/i },
  { name: 'xss_javascript',     regex: /javascript:/i },
];
