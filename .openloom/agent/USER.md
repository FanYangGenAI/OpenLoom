# USER.md

## ProfileSchemaVersion

- version: "1.0.0"
- mode: "hybrid"
- last_updated: "2026-04-24"

## StructuredProfile

### identity_static

- canonical_name: "Fan Yang"
- name_variants:
  - "Fan Yang"
  - "Fan YANG"
  - "YANG, FAN"
  - "杨帆"
- birth:
  date: "1984-09-27"
  place:
    city: "Unknown"
    province_or_state: "Anhui"
    country: "China"
  confidence: 0.98
  evidence_refs:
    - "evi_passport_main_page"
- nationality:
  - "People's Republic of China"

### lifecycle_dynamic

- current_primary_role:
  value: "Senior ML Engineer at Five9"
  period: "2024-08 to Present"
  location: "New York, NY"
  confidence: 0.94
  evidence_refs:
    - "evi_resume_2026_quant"
    - "evi_resume_formatted_2025"
- entrepreneurship_tracks:
  - value: "Founder/CTO at Jarvis-PIM"
    period: "2024 to Present"
    confidence: 0.86
    evidence_refs:
      - "evi_resume_formatted_2025"
      - "evi_cv_2025"
  - value: "Founder/CTO at Mindturi"
    period: "2023 to 2025"
    confidence: 0.82
    evidence_refs:
      - "evi_resume_formatted_2025"
      - "evi_cv_2025"
- family_signals:
  - value: "A child appears in family-context photos."
    period: "2021-09-27"
    location: "A home"
    confidence: 0.45
    evidence_refs:
      - "evi_image_child_home_20210927"
    note: "Weak signal only. Do not infer legal relationship without stronger evidence."
- residence_signals:
  - value: "Resides or works in New York area."
    period: "2024-08 to Present"
    location: "New York, NY"
    confidence: 0.88
    evidence_refs:
      - "evi_resume_2026_quant"
      - "evi_drive_safe_cert_20260117"

### spatiotemporal_timeline

- event_id: "evt_birth_19840927"
  event_type: "identity"
  time:
    start: "1984-09-27"
    end: "1984-09-27"
    text: "1984-09-27"
    precision: "day"
  location:
    city: "Unknown"
    province_or_state: "Anhui"
    country: "China"
    raw_text: "Anhui, China"
  statement: "Birth of Fan Yang."
  confidence: 0.98
  evidence_refs:
    - "evi_passport_main_page"

- event_id: "evt_education_wut_bs_ms"
  event_type: "education"
  time:
    start: null
    end: null
    text: "Undated"
    precision: "unknown"
  location:
    city: "Wuhan"
    province_or_state: "Hubei"
    country: "China"
    raw_text: "Wuhan University of Technology"
  statement: "Obtained B.S. and M.S. in Engineering from Wuhan University of Technology."
  confidence: 0.86
  evidence_refs:
    - "evi_resume_2026_quant"
    - "evi_resume_formatted_2025"
    - "evi_cv_2025"

- event_id: "evt_education_tongji_phd"
  event_type: "education"
  time:
    start: null
    end: null
    text: "Undated"
    precision: "unknown"
  location:
    city: "Shanghai"
    province_or_state: "Shanghai"
    country: "China"
    raw_text: "Tongji University"
  statement: "Earned a Ph.D. in Engineering from Tongji University."
  confidence: 0.9
  evidence_refs:
    - "evi_resume_2026_quant"
    - "evi_resume_formatted_2025"
    - "evi_cv_2025"

- event_id: "evt_education_usu_visiting"
  event_type: "education"
  time:
    start: null
    end: null
    text: "Undated"
    precision: "unknown"
  location:
    city: "Unknown"
    province_or_state: "Utah"
    country: "USA"
    raw_text: "Utah State University"
  statement: "Served as a visiting scholar at Utah State University."
  confidence: 0.89
  evidence_refs:
    - "evi_resume_2026_quant"
    - "evi_resume_formatted_2025"
    - "evi_cv_2025"

- event_id: "evt_work_alibaba_2017_2020"
  event_type: "work"
  time:
    start: "2017-01"
    end: "2020-12"
    text: "2017 - 2020"
    precision: "month"
  location:
    city: "Unknown"
    province_or_state: "Unknown"
    country: "Unknown"
    raw_text: "Unknown"
  statement: "Worked as a Data Scientist at Alibaba Group."
  confidence: 0.92
  evidence_refs:
    - "evi_resume_2026_quant"
    - "evi_resume_formatted_2025"
    - "evi_cv_2025"

- event_id: "evt_work_gwm_2020_2021"
  event_type: "work"
  time:
    start: "2020-01"
    end: "2021-12"
    text: "2020 - 2021"
    precision: "month"
  location:
    city: "Unknown"
    province_or_state: "Unknown"
    country: "Unknown"
    raw_text: "Unknown"
  statement: "Worked as a Senior Data Scientist at Great Wall Motor."
  confidence: 0.92
  evidence_refs:
    - "evi_resume_2026_quant"
    - "evi_resume_formatted_2025"
    - "evi_cv_2025"

- event_id: "evt_work_msft_202111_202405"
  event_type: "work"
  time:
    start: "2021-11"
    end: "2024-05"
    text: "Nov 2021 - May 2024"
    precision: "month"
  location:
    city: "New York"
    province_or_state: "NY"
    country: "USA"
    raw_text: "New York, NY (partial evidence)"
  statement: "Worked as a Senior Data Scientist at Microsoft."
  confidence: 0.94
  evidence_refs:
    - "evi_resume_2026_quant"
    - "evi_resume_formatted_2025"
    - "evi_cv_2025"

- event_id: "evt_work_five9_202408_present"
  event_type: "work"
  time:
    start: "2024-08"
    end: null
    text: "Aug 2024 - Present"
    precision: "month"
  location:
    city: "New York"
    province_or_state: "NY"
    country: "USA"
    raw_text: "New York, NY"
  statement: "Works as a Senior ML Engineer at Five9."
  confidence: 0.95
  evidence_refs:
    - "evi_resume_2026_quant"
    - "evi_resume_formatted_2025"
    - "evi_cv_2025"

- event_id: "evt_cert_drive_safe_20260117"
  event_type: "legal"
  time:
    start: "2026-01-17"
    end: "2026-01-17"
    text: "2026-01-17"
    precision: "day"
  location:
    city: "New York"
    province_or_state: "NY"
    country: "USA"
    raw_text: "New York, USA"
  statement: "Completed IDS NY Point & Insurance Reduction Program."
  confidence: 0.93
  evidence_refs:
    - "evi_drive_safe_cert_20260117"

### evidence_index

- evidence_id: "evi_passport_main_page"
  source_file: "D:\\open_loom_test_folder\\pictures\\护照.jpg"
  source_hash: "b0200ef1e8e9d0efce7bd895ee964477a354e22398a3fa2bba81cef3cd2999d9"
  extractor: "ImageAgent"
  extracted_at: "2026-04-24T13:19:02.098Z"
  excerpt: "Birth date/place and passport issuance details."

- evidence_id: "evi_resume_2026_quant"
  source_file: "D:\\open_loom_test_folder\\简历\\FanYang_AS_Resume_2026_quant.docx"
  source_hash: "59b1506151ed58ffca8d32fb3073aba7d6d425c2c4bd325e5869ba5777836bff"
  extractor: "TextDocAgent"
  extracted_at: "2026-04-24T13:19:05.202Z"
  excerpt: "Career timeline, education institutions, and New York residency signal."

- evidence_id: "evi_resume_formatted_2025"
  source_file: "D:\\open_loom_test_folder\\简历\\FanYang_Resume_Formatted_fan.docx"
  source_hash: "a29d13b82052f10cd2af2c91ead5c6b6d0877c91031fff4da5153bdf37e56ef3"
  extractor: "TextDocAgent"
  extracted_at: "2026-04-24T13:19:04.342Z"
  excerpt: "Career timeline and startup roles."

- evidence_id: "evi_cv_2025"
  source_file: "D:\\repo\\monorepo\\OpenLoom\\data\\fanyang\\FanYang_CV_2025.docx"
  source_hash: "6fab25e033e949fb5139f22825d25632bb49540c5912884827fcb59e95c74c22"
  extractor: "TextDocAgent"
  extracted_at: "2026-04-08T16:56:21.398Z"
  excerpt: "Cross-source confirmation for work and education timeline."

- evidence_id: "evi_drive_safe_cert_20260117"
  source_file: "D:\\open_loom_test_folder\\pictures\\I drive safe certification.jpg"
  source_hash: "5e53adada89e6adfdd71e4bd99096027bb0fc7fa5cca14bdc8dac2c337260137"
  extractor: "ImageAgent"
  extracted_at: "2026-04-24T13:19:00.719Z"
  excerpt: "NY certificate completion record."

- evidence_id: "evi_image_child_home_20210927"
  source_file: "D:\\repo\\monorepo\\OpenLoom\\data\\fanyang\\IMG_20210927_082112.jpg"
  source_hash: "99bdfc10f407f7c11140f03561e85dd02c6f5061fa0d3d0e26faaf17738a4339"
  extractor: "ImageAgent"
  extracted_at: "2026-04-08T16:56:20.543Z"
  excerpt: "A home-context photo including a young girl."

### sensitive_fields_policy

- strategy: "single_file_plaintext_with_runtime_guardrails"
- storage_policy: "Keep sensitive data in USER.md for local program and LLM processing."
- access_policy: "USER.md must only be read by local trusted runtime."
- logging_policy: "Never print full USER.md or sensitive fields in logs."
- external_export_policy: "Do not expose raw USER.md via external API or sharing flow."
- sensitive_field_catalog:
  - passport_number
  - id_card_number
  - driver_license_number
  - exact_street_address
  - phone_number
  - email
  - legal_document_validity_full

## NarrativeSummary

### General

Fan Yang is a senior ML practitioner currently based in the New York area, with a long-term profile spanning advanced engineering education, large-company data science roles, and startup leadership tracks.
evidence_refs: [evi_resume_2026_quant, evi_resume_formatted_2025, evi_cv_2025, evi_drive_safe_cert_20260117]

### Study

Fan Yang was born in Anhui, China (1984-09-27), and later completed B.S. and M.S. studies at Wuhan University of Technology before earning a Ph.D. at Tongji University. He also had a visiting scholar period at Utah State University.  
evidence_refs: [evi_passport_main_page, evi_resume_2026_quant, evi_resume_formatted_2025, evi_cv_2025]

### Work

From 2017 to 2020, he worked at Alibaba Group as a Data Scientist, then at Great Wall Motor as a Senior Data Scientist from 2020 to 2021. He joined Microsoft as a Senior Data Scientist (2021-11 to 2024-05), and since 2024-08 has been working as a Senior ML Engineer at Five9 in New York.  
evidence_refs: [evi_resume_2026_quant, evi_resume_formatted_2025, evi_cv_2025]

### Family

A home photo includes a young girl, but this remains a weak family signal and should not be interpreted as a confirmed legal relationship without more evidence.
evidence_refs: [evi_image_child_home_20210927]

### ResidenceAndMobility

The strongest current residence signal points to the New York area, supported by role location and official course completion records.
evidence_refs: [evi_resume_2026_quant, evi_drive_safe_cert_20260117]

## OpenQuestions

- Confirm exact start/end dates for education milestones and visiting scholar period.
- Validate whether startup roles overlapped with full-time roles and in what capacity.
- Add stronger evidence before promoting family-related signals to medium/high confidence.
